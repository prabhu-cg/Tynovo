import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { summarize } from '@/modules/brand-projects/schema'
import { createSampleProject } from '@/modules/brand-system/sample'
import { createProject } from '@/modules/brand-projects/model'
import { fakeClock, integratedProject } from '@/modules/testing/factories'
import { ProjectCard, type ProjectCardProps } from './ProjectCard'

const noop = () => undefined
const base = (over: Partial<ProjectCardProps>): ProjectCardProps => ({ summary: summarize(createProject('Plain', fakeClock())), onDuplicate: noop, onExport: noop, ...over })
const show = (props: ProjectCardProps) => render(<MemoryRouter><ul><ProjectCard {...props} /></ul></MemoryRouter>)
const theCard = () => document.querySelector('li[data-project]') as HTMLElement

describe('ProjectCard', () => {
  it('shows the key facts of a project at a glance', () => {
    const p = { ...integratedProject('Northwind'), brand: { ...integratedProject().brand, name: 'Northwind Labs', description: 'Planning software.', tones: ['technical' as const], useCases: ['saas' as const] } }
    show(base({ summary: summarize({ ...p, exportHistory: [{ id: 'e', kind: 'spec-md', at: '2026-05-01T10:00:00.000Z', filename: 'a', bytes: 1 }] }) }))
    const card = theCard()
    expect(within(card).getByRole('link', { name: 'Northwind' })).toHaveAttribute('href', expect.stringMatching(/^\/app\/projects\//))
    expect(card).toHaveTextContent('Brand: Northwind Labs')
    expect(card).toHaveTextContent('Planning software.')
    expect(within(card).getByRole('list', { name: 'Tone and use' })).toHaveTextContent('Technical')
    expect(within(card).getByRole('list', { name: 'Tone and use' })).toHaveTextContent('SaaS and software')
    const stats = Object.fromEntries([...card.querySelectorAll('dl > div')].map((d) => [d.querySelector('dt')!.textContent, d.querySelector('dd')!.textContent]))
    expect(stats).toEqual({ Fonts: '3 incl. your own', 'Roles with a font': '5 of 5', 'Own typeface': 'Northwind Sans', Exports: expect.stringMatching(/^1, last /) })
    expect(card).toHaveTextContent('Custom typeface')
  })

  it('says plainly when there is nothing yet', () => {
    show(base({}))
    const card = theCard()
    expect(card).toHaveTextContent('Fonts')
    expect(card).toHaveTextContent('None yet')
    expect(card).toHaveTextContent('0 of 5')
    expect(card).not.toHaveTextContent('Custom typeface')
  })

  it('keeps every action under one menu: no action buttons on the card itself', async () => {
    const user = userEvent.setup()
    show(base({}))
    const card = theCard()
    expect(within(card).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['More actions for Plain'])
    await user.click(within(card).getByRole('button', { name: 'More actions for Plain' }))
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Open Plain', 'Rename', 'Duplicate', 'Export project file', 'Delete…'])
  })

  it('the sample can be opened, duplicated and exported, but not renamed or deleted', async () => {
    const user = userEvent.setup()
    const onDuplicate = vi.fn()
    show(base({ summary: summarize(createSampleProject()), sample: true, onDuplicate }))
    expect(screen.getByTestId('sample-badge')).toHaveTextContent('Sample, read-only')
    await user.click(screen.getByRole('button', { name: 'More actions for Fieldnote sample' }))
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Open Fieldnote sample', 'Duplicate as my own project', 'Export project file'])
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate as my own project' }))
    expect(onDuplicate).toHaveBeenCalledTimes(1)
    expect(theCard()).toHaveTextContent('Built into Tynovo')
  })

  it('renaming replaces the title with a form on the card', async () => {
    const user = userEvent.setup()
    const submit = vi.fn()
    const cancel = vi.fn()
    show(base({ renaming: 'New name', onRenameSubmit: submit, onRenameCancel: cancel, onRenameChange: noop }))
    expect(screen.getByLabelText('New name for Plain')).toHaveValue('New name')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(submit).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(cancel).toHaveBeenCalled()
  })
})
