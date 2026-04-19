import { useState, useMemo, useEffect, useCallback } from 'react'
import { fetchAuthSession } from 'aws-amplify/auth'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { getAllQuestions, signupUser } from '../services/api'
import type { Question } from '../services/api'
import { awsConfig } from '../aws-config'

// Cloudscape imports
import { applyMode, Mode } from '@cloudscape-design/global-styles'
import '@cloudscape-design/global-styles/index.css'
import Table from '@cloudscape-design/components/table'
import Header from '@cloudscape-design/components/header'
import Button from '@cloudscape-design/components/button'
import SpaceBetween from '@cloudscape-design/components/space-between'
import Box from '@cloudscape-design/components/box'
import TextFilter from '@cloudscape-design/components/text-filter'
import Pagination from '@cloudscape-design/components/pagination'
import Container from '@cloudscape-design/components/container'
import FormField from '@cloudscape-design/components/form-field'
import Input from '@cloudscape-design/components/input'
import Select from '@cloudscape-design/components/select'
import Textarea from '@cloudscape-design/components/textarea'
import Tabs from '@cloudscape-design/components/tabs'
import Badge from '@cloudscape-design/components/badge'
import Alert from '@cloudscape-design/components/alert'
import ColumnLayout from '@cloudscape-design/components/column-layout'
import Form from '@cloudscape-design/components/form'
import Spinner from '@cloudscape-design/components/spinner'

const API_BASE_URL = awsConfig.API.REST.InterviewQuestionsAPI.endpoint

type QuestionForm = {
  question_text: string
  category: string
  competency: string
  difficulty: string
  reference_answer: string
}

const emptyForm: QuestionForm = {
  question_text: '',
  category: '',
  competency: '',
  difficulty: 'Medium',
  reference_answer: '',
}

const PAGE_SIZE = 20

// ── Overview Tab ──────────────────────────────────────────────────
function OverviewTab({ questions }: { questions: Question[] }) {
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    questions.forEach(q => { map[q.category] = (map[q.category] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [questions])

  const byDifficulty = useMemo(() => {
    const map: Record<string, number> = {}
    questions.forEach(q => { map[q.difficulty.toLowerCase()] = (map[q.difficulty.toLowerCase()] || 0) + 1 })
    return map
  }, [questions])

  return (
    <SpaceBetween size="l">
      <ColumnLayout columns={4} variant="text-grid" minColumnWidth={140}>
        <Container>
          <Box variant="awsui-key-label">Total Questions</Box>
          <Box variant="h1">{questions.length}</Box>
        </Container>
        <Container>
          <Box variant="awsui-key-label">Easy</Box>
          <Box variant="h1">{byDifficulty['easy'] || 0}</Box>
        </Container>
        <Container>
          <Box variant="awsui-key-label">Medium</Box>
          <Box variant="h1">{byDifficulty['medium'] || 0}</Box>
        </Container>
        <Container>
          <Box variant="awsui-key-label">Hard</Box>
          <Box variant="h1">{byDifficulty['hard'] || 0}</Box>
        </Container>
      </ColumnLayout>

      <Container header={<Header variant="h2">Questions by Category</Header>}>
        <Table
          columnDefinitions={[
            { id: 'category', header: 'Category', cell: item => item[0] },
            { id: 'count', header: 'Count', cell: item => item[1] },
            { id: 'pct', header: '%', cell: item => `${Math.round((item[1] / questions.length) * 100)}%` },
          ]}
          items={byCategory}
          variant="embedded"
        />
      </Container>
    </SpaceBetween>
  )
}

// ── Questions Tab ─────────────────────────────────────────────────
function QuestionsTab({
  questions, loading, onRefresh, getAuthToken,
}: {
  questions: Question[]; loading: boolean; onRefresh: () => void; getAuthToken: () => Promise<string | null>
}) {
  const [filterText, setFilterText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedItems, setSelectedItems] = useState<Question[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [createForm, setCreateForm] = useState<QuestionForm>(emptyForm)
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<{ success: number; failed: number } | null>(null)

  const categories = useMemo(() => {
    return [...new Set(questions.map(q => q.category))].sort()
  }, [questions])

  const competenciesFor = (category: string): string[] => {
    if (!category) return []
    return [...new Set(
      questions.filter(q => q.category === category).map(q => q.competency).filter(Boolean)
    )].sort() as string[]
  }

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchesText = !filterText || q.question_text.toLowerCase().includes(filterText.toLowerCase()) || q.category.toLowerCase().includes(filterText.toLowerCase()) || (q.competency || '').toLowerCase().includes(filterText.toLowerCase())
      const matchesCat = !selectedCategory || q.category === selectedCategory
      const matchesDiff = !selectedDifficulty || q.difficulty.toLowerCase() === selectedDifficulty.toLowerCase()
      return matchesText && matchesCat && matchesDiff
    })
  }, [questions, filterText, selectedCategory, selectedDifficulty])

  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredQuestions.slice(start, start + PAGE_SIZE)
  }, [filteredQuestions, currentPage])

  const showCompetencyColumn = filteredQuestions.some(q => q.competency)

  const handleCreate = async () => {
    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_BASE_URL}questions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!res.ok) { alert('Failed to create question'); return }
      onRefresh()
      setCreateForm(emptyForm)
      setShowCreateForm(false)
    } catch { alert('Failed to create question') }
  }

  const handleUpdate = async () => {
    if (!editingQuestion?.id) return
    try {
      const token = await getAuthToken()
      const res = await fetch(`${API_BASE_URL}questions/${editingQuestion.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: editingQuestion.question_text,
          category: editingQuestion.category,
          competency: editingQuestion.competency,
          difficulty: editingQuestion.difficulty,
          reference_answer: editingQuestion.reference_answer,
        }),
      })
      if (!res.ok) { alert('Failed to update'); return }
      onRefresh()
      setEditingQuestion(null)
    } catch { alert('Failed to update question') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question?')) return
    const token = await getAuthToken()
    await fetch(`${API_BASE_URL}questions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    onRefresh()
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedItems.length} questions?`)) return
    const token = await getAuthToken()
    for (const q of selectedItems) {
      await fetch(`${API_BASE_URL}questions/${q.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    }
    setSelectedItems([])
    onRefresh()
  }

  const handleExportCsv = () => {
    const rows = [
      ['question_text', 'category', 'difficulty', 'reference_answer'],
      ...questions.map(q => [`"${q.question_text.replace(/"/g, '""')}"`, q.category, q.difficulty, `"${(q.reference_answer || '').replace(/"/g, '""')}"`]),
    ]
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'questions.csv'
    a.click()
  }

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvUploading(true)
    setCsvResult(null)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      const startIdx = lines[0]?.toLowerCase().includes('question_text') ? 1 : 0
      const token = await getAuthToken()
      let success = 0, failed = 0
      for (const line of lines.slice(startIdx)) {
        const cols = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(c => c.replace(/^"|"$/g, '').trim())
        if (!cols || cols.length < 3) { failed++; continue }
        try {
          const res = await fetch(`${API_BASE_URL}questions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_text: cols[0], category: cols[1], difficulty: cols[2], reference_answer: cols[3] || '' }),
          })
          if (res.ok) success++; else failed++
        } catch { failed++ }
      }
      setCsvResult({ success, failed })
      onRefresh()
    } catch { alert('Failed to parse CSV') }
    finally { setCsvUploading(false); e.target.value = '' }
  }

  return (
    <SpaceBetween size="l">
      {csvResult && (
        <Alert type="success" dismissible onDismiss={() => setCsvResult(null)}>
          {csvResult.success} questions added{csvResult.failed > 0 && `, ${csvResult.failed} failed`}
        </Alert>
      )}

      {showCreateForm && (
        <Container header={<Header variant="h2">Create Question</Header>}>
          <Form actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowCreateForm(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreate}>Create</Button>
            </SpaceBetween>
          }>
            <SpaceBetween size="m">
              <FormField label="Question">
                <Textarea value={createForm.question_text} onChange={({ detail }) => setCreateForm({ ...createForm, question_text: detail.value })} rows={3} />
              </FormField>
              <div style={{ maxWidth: '720px' }}>
                <ColumnLayout columns={competenciesFor(createForm.category).length > 0 ? 3 : 2}>
                  <FormField label="Category">
                    <Select
                      selectedOption={createForm.category ? { label: createForm.category, value: createForm.category } : null}
                      onChange={({ detail }) => setCreateForm({ ...createForm, category: detail.selectedOption.value || '', competency: '' })}
                      options={categories.map(c => ({ label: c, value: c }))}
                      placeholder="Select category"
                    />
                  </FormField>
                  {competenciesFor(createForm.category).length > 0 && (
                    <FormField label="Subcategory">
                      <Select
                        selectedOption={createForm.competency ? { label: createForm.competency, value: createForm.competency } : null}
                        onChange={({ detail }) => setCreateForm({ ...createForm, competency: detail.selectedOption.value || '' })}
                        options={competenciesFor(createForm.category).map(c => ({ label: c, value: c }))}
                        placeholder="Select subcategory"
                      />
                    </FormField>
                  )}
                  <FormField label="Difficulty">
                    <Select
                      selectedOption={{ label: createForm.difficulty, value: createForm.difficulty }}
                      onChange={({ detail }) => setCreateForm({ ...createForm, difficulty: detail.selectedOption.value || 'Medium' })}
                      options={[{ label: 'Easy', value: 'Easy' }, { label: 'Medium', value: 'Medium' }, { label: 'Hard', value: 'Hard' }]}
                    />
                  </FormField>
                </ColumnLayout>
              </div>
              <FormField label="Reference Answer">
                <Textarea value={createForm.reference_answer} onChange={({ detail }) => setCreateForm({ ...createForm, reference_answer: detail.value })} rows={3} />
              </FormField>
            </SpaceBetween>
          </Form>
        </Container>
      )}

      {editingQuestion && (
        <Container header={<Header variant="h2">Edit Question</Header>}>
          <Form actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setEditingQuestion(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleUpdate}>Save</Button>
            </SpaceBetween>
          }>
            <SpaceBetween size="m">
              <FormField label="Question">
                <Textarea value={editingQuestion.question_text} onChange={({ detail }) => setEditingQuestion({ ...editingQuestion, question_text: detail.value })} rows={3} />
              </FormField>
              <div style={{ maxWidth: '720px' }}>
                <ColumnLayout columns={competenciesFor(editingQuestion.category).length > 0 ? 3 : 2}>
                  <FormField label="Category">
                    <Select
                      selectedOption={{ label: editingQuestion.category, value: editingQuestion.category }}
                      onChange={({ detail }) => setEditingQuestion({ ...editingQuestion, category: detail.selectedOption.value || '', competency: '' })}
                      options={categories.map(c => ({ label: c, value: c }))}
                    />
                  </FormField>
                  {competenciesFor(editingQuestion.category).length > 0 && (
                    <FormField label="Subcategory">
                      <Select
                        selectedOption={editingQuestion.competency ? { label: editingQuestion.competency, value: editingQuestion.competency } : null}
                        onChange={({ detail }) => setEditingQuestion({ ...editingQuestion, competency: detail.selectedOption.value || '' })}
                        options={competenciesFor(editingQuestion.category).map(c => ({ label: c, value: c }))}
                        placeholder="Select subcategory"
                      />
                    </FormField>
                  )}
                  <FormField label="Difficulty">
                    <Select
                      selectedOption={{ label: editingQuestion.difficulty, value: editingQuestion.difficulty }}
                      onChange={({ detail }) => setEditingQuestion({ ...editingQuestion, difficulty: detail.selectedOption.value || 'Medium' })}
                      options={[{ label: 'Easy', value: 'Easy' }, { label: 'Medium', value: 'Medium' }, { label: 'Hard', value: 'Hard' }]}
                    />
                  </FormField>
                </ColumnLayout>
              </div>
              <FormField label="Reference Answer">
                <Textarea value={editingQuestion.reference_answer || ''} onChange={({ detail }) => setEditingQuestion({ ...editingQuestion, reference_answer: detail.value })} rows={3} />
              </FormField>
            </SpaceBetween>
          </Form>
        </Container>
      )}

      <Table
        columnDefinitions={[
          { id: 'question', header: 'Question', cell: (item: Question) => item.question_text, width: 400 },
          { id: 'category', header: 'Category', cell: (item: Question) => item.category },
          ...(showCompetencyColumn ? [{ id: 'competency', header: 'Subcategory', cell: (item: Question) => item.competency || '—' }] : []),
          { id: 'difficulty', header: 'Difficulty', cell: (item: Question) => <Badge color={item.difficulty.toLowerCase() === 'easy' ? 'green' : item.difficulty.toLowerCase() === 'hard' ? 'red' : 'blue'}>{item.difficulty}</Badge> },
          { id: 'actions', header: 'Actions', cell: (item: Question) => (
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => { setEditingQuestion(item); setShowCreateForm(false) }}>Edit</Button>
              <Button variant="link" onClick={() => handleDelete(item.id)}>Delete</Button>
            </SpaceBetween>
          )},
        ]}
        items={paginatedQuestions}
        loading={loading}
        loadingText="Loading questions"
        wrapLines
        resizableColumns
        selectionType="multi"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
        trackBy="id"
        header={
          <Header
            variant="h2"
            counter={`(${filteredQuestions.length})`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                {selectedItems.length > 0 && <Button variant="normal" onClick={handleBulkDelete}>Delete {selectedItems.length} selected</Button>}
                <Button variant="normal" onClick={handleExportCsv}>Export CSV</Button>
                <Button variant="normal" iconName="upload" loading={csvUploading}>
                  <label style={{ cursor: 'pointer' }}>
                    Upload CSV
                    <input type="file" accept=".csv" onChange={handleCsvUpload} hidden />
                  </label>
                </Button>
                <Button variant="normal" iconName="refresh" onClick={onRefresh} loading={loading} />
                <Button variant="primary" onClick={() => { setShowCreateForm(true); setEditingQuestion(null) }}>Create Question</Button>
              </SpaceBetween>
            }
          >
            Questions
          </Header>
        }
        filter={
          <SpaceBetween direction="horizontal" size="xs">
            <TextFilter filteringText={filterText} onChange={({ detail }) => { setFilterText(detail.filteringText); setCurrentPage(1) }} filteringPlaceholder="Search questions..." />
            <Select
              selectedOption={selectedCategory ? { label: selectedCategory, value: selectedCategory } : { label: 'All categories', value: '' }}
              onChange={({ detail }) => { setSelectedCategory(detail.selectedOption.value || null); setCurrentPage(1) }}
              options={[{ label: 'All categories', value: '' }, ...categories.map(c => ({ label: c, value: c }))]}
            />
            <Select
              selectedOption={selectedDifficulty ? { label: selectedDifficulty, value: selectedDifficulty } : { label: 'All difficulties', value: '' }}
              onChange={({ detail }) => { setSelectedDifficulty(detail.selectedOption.value || null); setCurrentPage(1) }}
              options={[{ label: 'All difficulties', value: '' }, { label: 'Easy', value: 'easy' }, { label: 'Medium', value: 'medium' }, { label: 'Hard', value: 'hard' }]}
            />
          </SpaceBetween>
        }
        pagination={
          <Pagination
            currentPageIndex={currentPage}
            pagesCount={Math.ceil(filteredQuestions.length / PAGE_SIZE)}
            onChange={({ detail }) => setCurrentPage(detail.currentPageIndex)}
          />
        }
        empty={<Box textAlign="center" color="inherit"><b>No questions</b><Box padding={{ bottom: 's' }} variant="p" color="inherit">No questions match your filters.</Box></Box>}
      />
    </SpaceBetween>
  )
}

// ── Users Tab ─────────────────────────────────────────────────────
function UsersTab() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleInvite = async () => {
    setSubmitting(true)
    setStatus(null)
    try {
      const result = await signupUser(email, name)
      setStatus({ type: 'success', message: `User created. Temporary password sent to ${email}. Username: ${result.username}` })
      setEmail('')
      setName('')
    } catch (err: unknown) {
      setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to create user' })
    } finally { setSubmitting(false) }
  }

  return (
    <SpaceBetween size="l">
      {status && <Alert type={status.type} dismissible onDismiss={() => setStatus(null)}>{status.message}</Alert>}
      <Container header={<Header variant="h2" description="Creates a Cognito account and emails the user a temporary password.">Invite a New User</Header>}>
        <Form actions={<Button variant="primary" onClick={handleInvite} loading={submitting}>Create User & Send Invite</Button>}>
          <ColumnLayout columns={2}>
            <FormField label="Full Name">
              <Input value={name} onChange={({ detail }) => setName(detail.value)} placeholder="e.g. Jane Smith" />
            </FormField>
            <FormField label="Email Address">
              <Input value={email} onChange={({ detail }) => setEmail(detail.value)} placeholder="jane@example.com" type="email" />
            </FormField>
          </ColumnLayout>
        </Form>
      </Container>
    </SpaceBetween>
  )
}

// ── Root Admin Page ───────────────────────────────────────────────
function Admin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<Question[]>([])
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { getAuthToken } = useAuth()
  const { theme } = useTheme()

  // Sync Cloudscape's colour mode with the app's ThemeContext
  useEffect(() => {
    applyMode(theme === 'dark' ? Mode.Dark : Mode.Light)
    return () => { applyMode(Mode.Light) }
  }, [theme])

  const activeTab = searchParams.get('tab') || 'overview'
  const setTab = (tab: string) => setSearchParams({ tab })

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true)
      const token = await getAuthToken()
      const data = await getAllQuestions(token)
      setQuestions(data)
    } catch (error) {
      console.error('Error loading questions:', error)
    } finally { setLoading(false) }
  }, [getAuthToken])

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const session = await fetchAuthSession()
        const groups = (session.tokens?.accessToken?.payload['cognito:groups'] as string[]) || []
        if (groups.includes('Admin')) {
          setIsAdmin(true)
          await loadQuestions()
        } else {
          setIsAdmin(false)
          setLoading(false)
        }
      } catch {
        setIsAdmin(false)
        setLoading(false)
      }
    }
    checkAdminAccess()
  }, [loadQuestions])

  if (loading) {
    return (
      <Box padding="xxl" textAlign="center">
        <SpaceBetween size="m" alignItems="center">
          <Spinner size="large" />
          <Box variant="p" color="text-body-secondary">Loading admin console...</Box>
        </SpaceBetween>
      </Box>
    )
  }

  if (!isAdmin) {
    return (
      <Box padding="xxl" textAlign="center">
        <SpaceBetween size="m" alignItems="center">
          <Header variant="h1">Access Denied</Header>
          <Box variant="p" color="text-body-secondary">You need Admin group membership to access this page.</Box>
          <Button onClick={() => navigate('/')}>Back to Home</Button>
        </SpaceBetween>
      </Box>
    )
  }

  return (
    <Box padding={{ horizontal: 'l', vertical: 'l' }}>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description={`${questions.length} questions · manage content, categories and users`}
        >
          Admin Console
        </Header>
        <Tabs
          activeTabId={activeTab}
          onChange={({ detail }) => setTab(detail.activeTabId)}
          tabs={[
            { id: 'overview', label: 'Overview', content: <Box padding={{ top: 'l' }}><OverviewTab questions={questions} /></Box> },
            { id: 'questions', label: 'Questions', content: <Box padding={{ top: 'l' }}><QuestionsTab questions={questions} loading={loading} onRefresh={loadQuestions} getAuthToken={getAuthToken} /></Box> },
            { id: 'users', label: 'Users', content: <Box padding={{ top: 'l' }}><UsersTab /></Box> },
          ]}
        />
      </SpaceBetween>
    </Box>
  )
}

export default Admin
