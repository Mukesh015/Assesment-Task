import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  LogIn,
  LogOut,
  Plus,
  Radio,
  RefreshCw,
  Save,
  ShieldCheck,
  Trophy,
  Trash2,
  Vote,
} from 'lucide-react'
import { io, type Socket } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const SESSION_KEY = 'live-poll-session-id'
const VOTED_NOMINEE_KEY = 'live-poll-voted-nominee-id'
const VOTED_POLL_KEY = 'live-poll-voted-poll-id'
const ADMIN_TOKEN_KEY = 'live-poll-admin-token'

type ViewMode = 'vote' | 'admin'
type VoteState = 'idle' | 'submitting' | 'submitted'

type Nominee = {
  id: number
  name: string
  party: string
  description: string
  color: string
}

type PollSummary = {
  id: number
  title: string
  description: string
  createdAt: string
}

type ResultNominee = Nominee & {
  votes: number
  percentage: number
}

type PollResults = {
  poll: PollSummary | null
  totalVotes: number
  nominees: ResultNominee[]
}

type LoginResponse = {
  token: string
  admin: {
    id: number
    username: string
  }
}

type VoteResponse = {
  message: string
  results: PollResults
}

type CreatePollResponse = {
  message: string
  results: PollResults
}

type PollFormNominee = {
  name: string
  party: string
  description: string
  color: string
}

const defaultNomineeColors = ['#059669', '#2563eb', '#16a34a', '#f59e0b', '#e11d48']

const createDefaultPollNominees = (): PollFormNominee[] => [
  {
    name: 'Asha Rao',
    party: 'Civic Reform Party',
    description: 'Transparent governance and fast local services.',
    color: defaultNomineeColors[0],
  },
  {
    name: 'Miguel Hart',
    party: 'People First Alliance',
    description: 'Jobs, skills programs, and affordable housing.',
    color: defaultNomineeColors[1],
  },
]

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.'

const getSessionId = () => {
  const existing = window.localStorage.getItem(SESSION_KEY)
  if (existing) {
    return existing
  }

  const sessionId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  window.localStorage.setItem(SESSION_KEY, sessionId)
  return sessionId
}

const getStoredVote = () => {
  const pollId = Number(window.localStorage.getItem(VOTED_POLL_KEY))
  const nomineeId = Number(window.localStorage.getItem(VOTED_NOMINEE_KEY))

  if (!Number.isInteger(pollId) || !Number.isInteger(nomineeId)) {
    return null
  }

  return { pollId, nomineeId }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const data = (await response.json().catch(() => ({}))) as { message?: string }

  if (!response.ok) {
    throw new Error(data.message || 'Request failed.')
  }

  return data as T
}

function App() {
  const [mode, setMode] = useState<ViewMode>('vote')
  const [nominees, setNominees] = useState<Nominee[]>([])
  const [results, setResults] = useState<PollResults | null>(null)
  const [selectedNomineeId, setSelectedNomineeId] = useState<number | null>(() =>
    getStoredVote()?.nomineeId ?? null,
  )
  const [voteState, setVoteState] = useState<VoteState>(() =>
    getStoredVote() ? 'submitted' : 'idle',
  )
  const [notice, setNotice] = useState<string | null>(() =>
    getStoredVote() ? 'Your vote has been recorded for this browser session.' : null,
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [adminToken, setAdminToken] = useState(() =>
    window.localStorage.getItem(ADMIN_TOKEN_KEY),
  )
  const [adminUsername, setAdminUsername] = useState('admin')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [socketStatus, setSocketStatus] = useState(() =>
    window.localStorage.getItem(ADMIN_TOKEN_KEY) ? 'Connecting' : 'Offline',
  )
  const [pollTitle, setPollTitle] = useState('Community Election Poll')
  const [pollDescription, setPollDescription] = useState('Live audience voting session.')
  const [pollNominees, setPollNominees] = useState<PollFormNominee[]>(() =>
    createDefaultPollNominees(),
  )
  const [isCreatingPoll, setIsCreatingPoll] = useState(false)
  const [pollCreateMessage, setPollCreateMessage] = useState<string | null>(null)
  const [pollCreateError, setPollCreateError] = useState<string | null>(null)

  const leader = useMemo(() => {
    if (!results?.nominees.length || results.totalVotes === 0) {
      return null
    }

    return results.nominees.reduce((current, nominee) =>
      nominee.votes > current.votes ? nominee : current,
    )
  }, [results])

  const syncVoteStateForPoll = useCallback((pollId: number | null) => {
    const storedVote = getStoredVote()

    if (pollId && storedVote?.pollId === pollId) {
      setSelectedNomineeId(storedVote.nomineeId)
      setVoteState('submitted')
      setNotice('Your vote has been recorded for this browser session.')
      return
    }

    window.localStorage.removeItem(VOTED_POLL_KEY)
    window.localStorage.removeItem(VOTED_NOMINEE_KEY)
    setSelectedNomineeId(null)
    setVoteState('idle')
    setNotice(null)
  }, [])

  const applyResults = useCallback(
    (data: PollResults) => {
      setResults(data)
      setNominees(
        data.nominees.map((nominee) => ({
          id: nominee.id,
          name: nominee.name,
          party: nominee.party,
          description: nominee.description,
          color: nominee.color,
        })),
      )
      syncVoteStateForPoll(data.poll?.id ?? null)
    },
    [syncVoteStateForPoll],
  )

  const refreshResults = useCallback(async () => {
    const data = await requestJson<PollResults>('/api/results')
    applyResults(data)
  }, [applyResults])

  const resetStoredVote = useCallback(() => {
    window.localStorage.removeItem(VOTED_POLL_KEY)
    window.localStorage.removeItem(VOTED_NOMINEE_KEY)
    setSelectedNomineeId(null)
    setVoteState('idle')
    setNotice('A new poll is ready for voting.')
  }, [])

  const loadInitialData = useCallback(async () => {
    setLoadError(null)
    setIsRefreshing(true)

    try {
      const [nomineeData, resultData] = await Promise.all([
        requestJson<Nominee[]>('/api/nominees'),
        requestJson<PollResults>('/api/results'),
      ])
      setNominees(nomineeData)
      setResults(resultData)
      syncVoteStateForPoll(resultData.poll?.id ?? null)
    } catch (error) {
      setLoadError(getErrorMessage(error))
    } finally {
      setIsRefreshing(false)
    }
  }, [syncVoteStateForPoll])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadInitialData()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadInitialData])

  useEffect(() => {
    if (!adminToken) {
      return
    }

    const socket: Socket = io(API_URL, {
      auth: { token: adminToken },
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      setSocketStatus('Live')
    })

    socket.on('disconnect', () => {
      setSocketStatus('Offline')
    })

    socket.on('connect_error', (error) => {
      setSocketStatus(error.message || 'Socket error')
    })

    socket.on('results:update', (nextResults: PollResults) => {
      applyResults(nextResults)
    })

    return () => {
      socket.disconnect()
    }
  }, [adminToken, applyResults])

  const handleVote = async () => {
    if (!selectedNomineeId || voteState === 'submitted') {
      return
    }

    setVoteState('submitting')
    setNotice(null)

    try {
      const response = await requestJson<VoteResponse>('/api/votes', {
        method: 'POST',
        body: JSON.stringify({
          nomineeId: selectedNomineeId,
          sessionId: getSessionId(),
        }),
      })
      if (response.results.poll) {
        window.localStorage.setItem(VOTED_POLL_KEY, String(response.results.poll.id))
      }
      window.localStorage.setItem(VOTED_NOMINEE_KEY, String(selectedNomineeId))
      applyResults(response.results)
      setSelectedNomineeId(selectedNomineeId)
      setVoteState('submitted')
      setNotice(response.message)
    } catch (error) {
      setVoteState('idle')
      setNotice(getErrorMessage(error))
      await refreshResults().catch(() => undefined)
    }
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAdminError(null)
    setIsLoggingIn(true)

    try {
      const response = await requestJson<LoginResponse>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          username: adminUsername,
          password: adminPassword,
        }),
      })
      window.localStorage.setItem(ADMIN_TOKEN_KEY, response.token)
      setSocketStatus('Connecting')
      setAdminToken(response.token)
      setAdminPassword('')
      setMode('admin')
      await refreshResults()
    } catch (error) {
      setAdminError(getErrorMessage(error))
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = () => {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY)
    setAdminToken(null)
    setSocketStatus('Offline')
  }

  const handlePollNomineeChange = (
    index: number,
    field: keyof PollFormNominee,
    value: string,
  ) => {
    setPollNominees((currentNominees) =>
      currentNominees.map((nominee, nomineeIndex) =>
        nomineeIndex === index ? { ...nominee, [field]: value } : nominee,
      ),
    )
  }

  const handleAddPollNominee = () => {
    setPollNominees((currentNominees) => {
      if (currentNominees.length >= 5) {
        return currentNominees
      }

      return [
        ...currentNominees,
        {
          name: '',
          party: '',
          description: '',
          color: defaultNomineeColors[currentNominees.length],
        },
      ]
    })
  }

  const handleRemovePollNominee = (index: number) => {
    setPollNominees((currentNominees) =>
      currentNominees.length <= 2
        ? currentNominees
        : currentNominees.filter((_, nomineeIndex) => nomineeIndex !== index),
    )
  }

  const handleCreatePoll = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!adminToken) {
      setPollCreateError('Admin login is required.')
      return
    }

    setIsCreatingPoll(true)
    setPollCreateError(null)
    setPollCreateMessage(null)

    try {
      const response = await requestJson<CreatePollResponse>('/api/admin/polls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          title: pollTitle,
          description: pollDescription,
          nominees: pollNominees,
        }),
      })

      applyResults(response.results)
      resetStoredVote()
      setPollCreateMessage(response.message)
    } catch (error) {
      setPollCreateError(getErrorMessage(error))
    } finally {
      setIsCreatingPoll(false)
    }
  }

  const selectedNominee = nominees.find((nominee) => nominee.id === selectedNomineeId)
  const hasVoted = voteState === 'submitted'

  return (
    <div className="min-h-svh bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-emerald-600 text-white">
              <Radio size={22} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Live Polling System</h1>
              <p className="text-sm text-slate-500">Election vote portal</p>
            </div>
          </div>

          <nav className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                mode === 'vote'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              type="button"
              onClick={() => setMode('vote')}
            >
              <Vote size={16} aria-hidden="true" />
              Vote
            </button>
            <button
              className={`flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition ${
                mode === 'admin'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              type="button"
              onClick={() => setMode('admin')}
            >
              <ShieldCheck size={16} aria-hidden="true" />
              Admin
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)] lg:px-6">
        <section className="min-w-0">
          {loadError ? (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
              <AlertCircle className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
              <p className="text-sm font-medium">{loadError}</p>
            </div>
          ) : null}

          {mode === 'vote' ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">
                    {results?.poll?.title ?? 'Audience Vote'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {hasVoted && selectedNominee
                      ? `Voted for ${selectedNominee.name}`
                      : results?.poll?.description || 'Choose one nominee'}
                  </p>
                </div>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={() => void loadInitialData()}
                  disabled={isRefreshing}
                >
                  <RefreshCw size={16} aria-hidden="true" />
                  Refresh
                </button>
              </div>

              <div className="mt-5 grid gap-3">
                {nominees.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm font-medium text-slate-500">
                    No active poll is available yet.
                  </div>
                ) : null}

                {nominees.map((nominee) => {
                  const isSelected = selectedNomineeId === nominee.id

                  return (
                    <button
                      className={`group grid min-h-28 grid-cols-[8px_minmax(0,1fr)_28px] overflow-hidden rounded-lg border text-left transition ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      } ${hasVoted ? 'cursor-default' : ''}`}
                      key={nominee.id}
                      type="button"
                      disabled={hasVoted}
                      onClick={() => setSelectedNomineeId(nominee.id)}
                    >
                      <span style={{ backgroundColor: nominee.color }} />
                      <span className="min-w-0 p-4">
                        <span className="block text-lg font-semibold text-slate-950">
                          {nominee.name}
                        </span>
                        <span className="mt-1 block text-sm font-medium text-slate-600">
                          {nominee.party}
                        </span>
                        <span className="mt-2 block text-sm leading-6 text-slate-500">
                          {nominee.description}
                        </span>
                      </span>
                      <span className="grid place-items-center pr-3 text-emerald-700">
                        {isSelected ? <CheckCircle2 size={21} aria-hidden="true" /> : null}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-h-6 text-sm font-medium text-slate-600">{notice}</p>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  type="button"
                  disabled={!selectedNomineeId || hasVoted || voteState === 'submitting'}
                  onClick={() => void handleVote()}
                >
                  <Vote size={17} aria-hidden="true" />
                  {voteState === 'submitting' ? 'Submitting' : 'Submit Vote'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Admin Console</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {adminToken ? `Socket status: ${socketStatus}` : 'Admin sign in'}
                  </p>
                </div>
                {adminToken ? (
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    type="button"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} aria-hidden="true" />
                    Logout
                  </button>
                ) : null}
              </div>

              {!adminToken ? (
                <form className="mt-5 grid gap-4" onSubmit={handleLogin}>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Username
                    <input
                      className="rounded-md border border-slate-200 px-3 py-3 font-normal text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      value={adminUsername}
                      onChange={(event) => setAdminUsername(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Password
                    <input
                      className="rounded-md border border-slate-200 px-3 py-3 font-normal text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      type="password"
                      value={adminPassword}
                      onChange={(event) => setAdminPassword(event.target.value)}
                    />
                  </label>
                  {adminError ? (
                    <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">
                      <AlertCircle size={17} aria-hidden="true" />
                      {adminError}
                    </div>
                  ) : null}
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={isLoggingIn}
                    type="submit"
                  >
                    <LogIn size={17} aria-hidden="true" />
                    {isLoggingIn ? 'Signing in' : 'Sign In'}
                  </button>
                </form>
              ) : (
                <div className="mt-5 grid gap-5">
                  <CreatePollForm
                    title={pollTitle}
                    description={pollDescription}
                    nominees={pollNominees}
                    isCreating={isCreatingPoll}
                    message={pollCreateMessage}
                    error={pollCreateError}
                    onTitleChange={setPollTitle}
                    onDescriptionChange={setPollDescription}
                    onNomineeChange={handlePollNomineeChange}
                    onAddNominee={handleAddPollNominee}
                    onRemoveNominee={handleRemovePollNominee}
                    onSubmit={handleCreatePoll}
                  />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric label="Total Votes" value={results?.totalVotes ?? 0} />
                    <Metric label="Active Poll" value={results?.poll?.title ?? 'None'} />
                    <Metric label="Leader" value={leader?.name ?? 'Pending'} />
                  </div>

                  <button
                    className="inline-flex w-fit items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    type="button"
                    onClick={() => void refreshResults()}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    Sync Results
                  </button>

                  <ResultsTable results={results} />
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="min-w-0">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Live Count</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {results?.poll?.title ?? 'No active poll'} - {results?.totalVotes ?? 0} votes
                </p>
              </div>
              <div className="grid size-10 place-items-center rounded-lg bg-amber-100 text-amber-700">
                <BarChart3 size={21} aria-hidden="true" />
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              {(results?.nominees ?? []).map((nominee) => (
                <div key={nominee.id}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-semibold text-slate-800">{nominee.name}</span>
                    <span className="shrink-0 font-semibold text-slate-600">
                      {nominee.votes} votes
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-md bg-slate-100">
                    <div
                      className="h-full rounded-md transition-all duration-500"
                      style={{
                        backgroundColor: nominee.color,
                        width: `${Math.max(
                          nominee.percentage,
                          nominee.votes > 0 ? 4 : 0,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {nominee.percentage.toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>

            {leader ? (
              <div className="mt-5 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <Trophy className="shrink-0" size={19} aria-hidden="true" />
                <p className="text-sm font-semibold">
                  {leader.name} leads with {leader.votes} votes.
                </p>
              </div>
            ) : null}
          </div>
        </aside>
      </main>
    </div>
  )
}

type CreatePollFormProps = {
  title: string
  description: string
  nominees: PollFormNominee[]
  isCreating: boolean
  message: string | null
  error: string | null
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onNomineeChange: (index: number, field: keyof PollFormNominee, value: string) => void
  onAddNominee: () => void
  onRemoveNominee: (index: number) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function CreatePollForm({
  title,
  description,
  nominees,
  isCreating,
  message,
  error,
  onTitleChange,
  onDescriptionChange,
  onNomineeChange,
  onAddNominee,
  onRemoveNominee,
  onSubmit,
}: CreatePollFormProps) {
  return (
    <form className="grid gap-4 border-b border-slate-200 pb-5" onSubmit={onSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Create Poll</h3>
          <p className="mt-1 text-sm text-slate-500">Active election setup</p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={nominees.length >= 5}
          type="button"
          onClick={onAddNominee}
        >
          <Plus size={16} aria-hidden="true" />
          Add Nominee
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Poll Title
          <input
            className="rounded-md border border-slate-200 px-3 py-3 font-normal text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            maxLength={150}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Description
          <input
            className="rounded-md border border-slate-200 px-3 py-3 font-normal text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            maxLength={255}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-3">
        {nominees.map((nominee, index) => (
          <div
            className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[48px_minmax(0,1fr)_minmax(0,1fr)_44px]"
            key={`${index}-${nominee.color}`}
          >
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Color
              <input
                className="h-11 w-full rounded-md border border-slate-200 bg-white p-1"
                type="color"
                value={nominee.color}
                onChange={(event) => onNomineeChange(index, 'color', event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Name
              <input
                className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-3 font-normal text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                maxLength={120}
                value={nominee.name}
                onChange={(event) => onNomineeChange(index, 'name', event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Party
              <input
                className="min-w-0 rounded-md border border-slate-200 bg-white px-3 py-3 font-normal text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                maxLength={120}
                value={nominee.party}
                onChange={(event) => onNomineeChange(index, 'party', event.target.value)}
              />
            </label>
            <button
              className="mt-7 grid size-11 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={nominees.length <= 2}
              title="Remove nominee"
              type="button"
              onClick={() => onRemoveNominee(index)}
            >
              <Trash2 size={17} aria-hidden="true" />
            </button>
            <label className="grid gap-2 text-sm font-semibold text-slate-700 sm:col-span-4">
              Nominee Summary
              <input
                className="rounded-md border border-slate-200 bg-white px-3 py-3 font-normal text-slate-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                maxLength={255}
                value={nominee.description}
                onChange={(event) => onNomineeChange(index, 'description', event.target.value)}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          className={`min-h-6 text-sm font-medium ${
            error ? 'text-rose-700' : 'text-slate-600'
          }`}
        >
          {error ?? message}
        </p>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={isCreating}
          type="submit"
        >
          <Save size={17} aria-hidden="true" />
          {isCreating ? 'Creating' : 'Create Poll'}
        </button>
      </div>
    </form>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  )
}

function ResultsTable({ results }: { results: PollResults | null }) {
  if (!results) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-500">
        Results unavailable.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Nominee</th>
            <th className="px-4 py-3 font-semibold">Votes</th>
            <th className="px-4 py-3 font-semibold">Share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {results.nominees.map((nominee) => (
            <tr key={nominee.id}>
              <td className="px-4 py-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: nominee.color }}
                  />
                  <span className="truncate font-semibold text-slate-900">{nominee.name}</span>
                </span>
              </td>
              <td className="px-4 py-3 font-semibold text-slate-700">{nominee.votes}</td>
              <td className="px-4 py-3 font-semibold text-slate-700">
                {nominee.percentage.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default App
