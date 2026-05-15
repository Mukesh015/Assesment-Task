import bcrypt from 'bcryptjs'
import { env } from '../config/env'
import { AppDataSource } from '../database/data-source'
import { AdminUser } from '../entities/AdminUser'
import { Nominee } from '../entities/Nominee'
import { Poll } from '../entities/Poll'
import { Vote } from '../entities/Vote'

const defaultNominees = [
  {
    name: 'Asha Rao',
    party: 'Civic Reform Party',
    description: 'Focused on transparent governance and fast local services.',
    color: '#059669',
  },
  {
    name: 'Miguel Hart',
    party: 'People First Alliance',
    description: 'Campaigning for jobs, skills programs, and affordable housing.',
    color: '#2563eb',
  },
  {
    name: 'Nora Chen',
    party: 'Green Future Bloc',
    description: 'Prioritising clean energy, public transport, and urban gardens.',
    color: '#16a34a',
  },
  {
    name: 'Imran Shah',
    party: 'Workers Union Front',
    description: 'Advocating fair wages, workplace safety, and health access.',
    color: '#f59e0b',
  },
  {
    name: 'Elena Brooks',
    party: 'Independent',
    description: 'Running on education quality and community budgeting.',
    color: '#e11d48',
  },
]

export const seedInitialData = async () => {
  const pollRepository = AppDataSource.getRepository(Poll)
  const nomineeRepository = AppDataSource.getRepository(Nominee)
  const adminRepository = AppDataSource.getRepository(AdminUser)

  let activePoll = await pollRepository.findOne({
    where: { isActive: true },
    order: { id: 'DESC' },
  })

  if (!activePoll) {
    activePoll = await pollRepository.save(
      pollRepository.create({
        title: 'First Phase Election Poll',
        description: 'Default seeded poll for the live election.',
        isActive: true,
      }),
    )
  }

  const nomineeCount = await nomineeRepository.count()
  if (nomineeCount === 0) {
    await nomineeRepository.save(
      defaultNominees.map((nominee) =>
        nomineeRepository.create({
          ...nominee,
          pollId: activePoll.id,
          poll: activePoll,
        }),
      ),
    )
  } else {
    await nomineeRepository
      .createQueryBuilder()
      .update(Nominee)
      .set({ pollId: activePoll.id })
      .where('pollId IS NULL')
      .execute()

    await AppDataSource.getRepository(Vote)
      .createQueryBuilder()
      .update(Vote)
      .set({ pollId: activePoll.id })
      .where('pollId IS NULL')
      .execute()
  }

  const admin = await adminRepository.findOne({
    where: { username: env.admin.username },
  })

  if (!admin) {
    const passwordHash = await bcrypt.hash(env.admin.password, 10)
    await adminRepository.save(
      adminRepository.create({
        username: env.admin.username,
        passwordHash,
      }),
    )
  }
}
