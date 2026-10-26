import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ActionMenu } from './ActionMenu'

const setup = () => {
  const onRename = vi.fn()
  const onDelete = vi.fn()
  render(
    <MemoryRouter>
      <button>outside</button>
      <ActionMenu label="More actions for Alpha" items={[{ id: 'open', label: 'Open', to: '/x' }, { id: 'rename', label: 'Rename', onSelect: onRename }, { id: 'delete', label: 'Delete…', onSelect: onDelete, danger: true }]} />
    </MemoryRouter>,
  )
  return { onRename, onDelete, trigger: screen.getByRole('button', { name: 'More actions for Alpha' }) }
}

describe('ActionMenu', () => {
  it('is closed by default and announces that it opens a menu', () => {
    const { trigger } = setup()
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('opens on click, focuses the first action, and runs an action then closes', async () => {
    const user = userEvent.setup()
    const { trigger, onRename } = setup()
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Open', 'Rename', 'Delete…'])
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(onRename).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('works by keyboard: arrows, Home and End move, Escape closes and returns to the button', async () => {
    const user = userEvent.setup()
    const { trigger, onDelete } = setup()
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Delete…' })).toHaveFocus()
    await user.keyboard('{ArrowDown}') // wraps
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Delete…' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('menuitem', { name: 'Delete…' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger).toHaveFocus()
    await user.keyboard('{ArrowDown}{End}{Enter}')
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('closes when you click elsewhere or tab away, and a link item navigates', async () => {
    const user = userEvent.setup()
    const { trigger } = setup()
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(trigger)
    await user.tab()
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Open' })).toHaveAttribute('href', '/x')
  })
})
