import { QueryFailedError } from 'typeorm'
import { AppDataSource } from '../database/data-source'
import { Nominee } from '../entities/Nominee'
import { Poll } from '../entities/Poll'
import { Vote } from '../entities/Vote'
import { HttpError } from '../middleware/http-error'

export type PollDto = {
  id: number
  title: string
  description: string
  createdAt: Date
}

export type NomineeDto = {
  id: number
  name: string
  party: string
  description: string
  color: string
}

export type ResultNomineeDto = NomineeDto & {
  votes: number
  percentage: number
}

export type PollResultsDto = {
  poll: PollDto | null
  totalVotes: number
  nominees: ResultNomineeDto[]
}

type RawResultRow = {
  id: number | string
  name: string
  party: string
  description: string
  color: string
  votes: string
}

type CastVoteInput = {
  nomineeId: number
  sessionId: string
}

type CreatePollNomineeInput = {
  name?: string
  party?: string
  description?: string
  color?: string
}

type CreatePollInput = {
  title?: string
  description?: string
  nominees?: CreatePollNomineeInput[]
}

const fallbackColors = ['#059669', '#2563eb', '#16a34a', '#f59e0b', '#e11d48']

const toPollDto = (poll: Poll): PollDto => ({
  id: poll.id,
  title: poll.title,
  description: poll.description,
  createdAt: poll.createdAt,
})

const toNomineeDto = (nominee: Nominee): NomineeDto => ({
  id: nominee.id,
  name: nominee.name,
  party: nominee.party,
  description: nominee.description,
  color: nominee.color,
})

const isDuplicateSessionError = (error: unknown) => {
  if (!(error instanceof QueryFailedError)) {
    return false
  }

  const driverError = error.driverError as { code?: string; errno?: number }
  return driverError.code === 'ER_DUP_ENTRY' || driverError.errno === 1062
}

const getActivePoll = () =>
  AppDataSource.getRepository(Poll).findOne({
    where: { isActive: true },
    order: { id: 'DESC' },
  })

export const listNominees = async (): Promise<NomineeDto[]> => {
  const activePoll = await getActivePoll()
  if (!activePoll) {
    return []
  }

  const nominees = await AppDataSource.getRepository(Nominee).find({
    where: { isActive: true, pollId: activePoll.id },
    order: { id: 'ASC' },
  })

  return nominees.map(toNomineeDto)
}

export const getResults = async (): Promise<PollResultsDto> => {
  const activePoll = await getActivePoll()
  if (!activePoll) {
    return {
      poll: null,
      totalVotes: 0,
      nominees: [],
    }
  }

  const rows = await AppDataSource.getRepository(Nominee)
    .createQueryBuilder('nominee')
    .leftJoin('nominee.votes', 'vote', 'vote.pollId = :pollId', {
      pollId: activePoll.id,
    })
    .select('nominee.id', 'id')
    .addSelect('nominee.name', 'name')
    .addSelect('nominee.party', 'party')
    .addSelect('nominee.description', 'description')
    .addSelect('nominee.color', 'color')
    .addSelect('COUNT(vote.id)', 'votes')
    .where('nominee.isActive = :isActive', { isActive: true })
    .andWhere('nominee.pollId = :pollId', { pollId: activePoll.id })
    .groupBy('nominee.id')
    .addGroupBy('nominee.name')
    .addGroupBy('nominee.party')
    .addGroupBy('nominee.description')
    .addGroupBy('nominee.color')
    .orderBy('nominee.id', 'ASC')
    .getRawMany<RawResultRow>()

  const totalVotes = rows.reduce((total, row) => total + Number(row.votes), 0)

  return {
    poll: toPollDto(activePoll),
    totalVotes,
    nominees: rows.map((row) => {
      const votes = Number(row.votes)
      const percentage = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 1000) / 10

      return {
        id: Number(row.id),
        name: row.name,
        party: row.party,
        description: row.description,
        color: row.color,
        votes,
        percentage,
      }
    }),
  }
}

export const castVote = async ({ nomineeId, sessionId }: CastVoteInput) => {
  const cleanedSessionId = sessionId.trim()
  const activePoll = await getActivePoll()

  if (!activePoll) {
    throw new HttpError(404, 'No active poll is available.')
  }

  if (!Number.isInteger(nomineeId) || nomineeId <= 0) {
    throw new HttpError(400, 'A valid nominee is required.')
  }

  if (cleanedSessionId.length < 8 || cleanedSessionId.length > 100) {
    throw new HttpError(400, 'A valid session id is required.')
  }

  const voteRepository = AppDataSource.getRepository(Vote)
  const existingVote = await voteRepository.findOne({
    where: { sessionId: cleanedSessionId, pollId: activePoll.id },
  })

  if (existingVote) {
    throw new HttpError(409, 'This browser session has already voted.')
  }

  const nominee = await AppDataSource.getRepository(Nominee).findOne({
    where: { id: nomineeId, isActive: true, pollId: activePoll.id },
  })

  if (!nominee) {
    throw new HttpError(404, 'Nominee not found.')
  }

  const vote = voteRepository.create({
    sessionId: cleanedSessionId,
    nomineeId: nominee.id,
    pollId: activePoll.id,
    poll: activePoll,
    nominee,
  })

  try {
    return await voteRepository.save(vote)
  } catch (error) {
    if (isDuplicateSessionError(error)) {
      throw new HttpError(409, 'This browser session has already voted.')
    }

    throw error
  }
}

export const createPoll = async ({ title, description, nominees }: CreatePollInput) => {
  const cleanedTitle = title?.trim()
  const cleanedDescription = description?.trim() ?? ''

  if (!cleanedTitle || cleanedTitle.length > 150) {
    throw new HttpError(400, 'Poll title is required and must be under 150 characters.')
  }

  if (cleanedDescription.length > 255) {
    throw new HttpError(400, 'Poll description must be under 255 characters.')
  }

  if (!Array.isArray(nominees) || nominees.length < 2 || nominees.length > 5) {
    throw new HttpError(400, 'Create between 2 and 5 nominees.')
  }

  const cleanedNominees = nominees.map((nominee, index) => {
    const name = nominee.name?.trim()
    const party = nominee.party?.trim()
    const nomineeDescription = nominee.description?.trim() ?? ''
    const color = nominee.color?.trim() || fallbackColors[index]

    if (!name || !party) {
      throw new HttpError(400, 'Each nominee needs a name and party.')
    }

    if (name.length > 120 || party.length > 120 || nomineeDescription.length > 255) {
      throw new HttpError(400, 'Nominee fields are too long.')
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      throw new HttpError(400, 'Nominee colors must be hex colors.')
    }

    return {
      name,
      party,
      description: nomineeDescription,
      color,
    }
  })

  await AppDataSource.transaction(async (manager) => {
    await manager.createQueryBuilder().delete().from(Vote).execute()
    await manager.update(Poll, { isActive: true }, { isActive: false })
    await manager.update(Nominee, { isActive: true }, { isActive: false })

    const poll = await manager.save(
      Poll,
      manager.create(Poll, {
        title: cleanedTitle,
        description: cleanedDescription,
        isActive: true,
      }),
    )

    await manager.save(
      Nominee,
      cleanedNominees.map((nominee) =>
        manager.create(Nominee, {
          ...nominee,
          pollId: poll.id,
          poll,
          isActive: true,
        }),
      ),
    )
  })

  return getResults()
}
