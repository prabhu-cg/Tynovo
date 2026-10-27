import { ActionMenu } from './ActionMenu'
import { MoonIcon, SunIcon } from './icons'
import { useTheme, resolveTheme } from './theme'

/** Light, Dark or System, as a small menu behind one icon button (as on Doxa). The icon shows what is currently displayed. */
export function ThemeMenu() {
  const [preference, setPreference] = useTheme()
  const shown = resolveTheme(preference)
  return (
    <ActionMenu
      label="Colour theme"
      icon={shown === 'dark' ? <MoonIcon /> : <SunIcon />}
      items={[
        { id: 'light', label: 'Light', checked: preference === 'light', onSelect: () => setPreference('light') },
        { id: 'dark', label: 'Dark', checked: preference === 'dark', onSelect: () => setPreference('dark') },
        { id: 'system', label: 'System', checked: preference === 'system', onSelect: () => setPreference('system') },
      ]}
    />
  )
}
