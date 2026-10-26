import { useId, useState, type ReactNode } from 'react'
import type { License } from '@/modules/brand-projects/schema'
import { psName } from '@/modules/font-export/fontFluxBuilder'
import { FONT_VERSION } from '@/modules/font-export/typefaceExport'
import { Banner, inputClass } from '@/modules/shared-ui'
import { LICENSE_PLACEHOLDER } from '@/modules/typeface-engine/typeface'
import type { TypefaceHandle } from './useTypeface'

/** Licences offered as a convenience. Choosing one fills in its name and link; it does not make the choice right for you. */
const PRESETS: Array<{ id: string; label: string; license: Omit<License, 'verified'> }> = [
  { id: 'ofl', label: 'SIL Open Font License 1.1', license: { name: 'SIL Open Font License 1.1', spdx: 'OFL-1.1', url: 'https://openfontlicense.org' } },
  { id: 'apache', label: 'Apache License 2.0', license: { name: 'Apache License 2.0', spdx: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' } },
  { id: 'cc0', label: 'CC0 1.0 (public domain dedication)', license: { name: 'CC0 1.0 Universal', spdx: 'CC0-1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' } },
  { id: 'arr', label: 'All rights reserved', license: { name: 'All rights reserved' } },
]

const canParseUrl = (s: string) => {
  try {
    return new URL(s).protocol.startsWith('http')
  } catch {
    return false
  }
}

function Field({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-ink-strong">{label}</label>
      {children}
      {hint ? <p className="text-xs text-ink-soft">{hint}</p> : null}
    </div>
  )
}

export function InfoTab({ handle }: { handle: TypefaceHandle }) {
  const { face, update } = handle
  const ids = { family: useId(), copyright: useId(), preset: useId(), name: useId(), url: useId(), spdx: useId() }
  const [urlText, setUrlText] = useState(face.license.url ?? '')
  const lic = face.license
  const hasLicense = lic.name.trim() !== '' && lic.name !== LICENSE_PLACEHOLDER
  const setLicense = (next: Partial<License>) =>
    update((f) => {
      const merged = { ...f.license, ...next }
      // Optional fields leave the object when empty, so a cleared field never leaves "undefined" in the project.
      const clean: License = { name: merged.name, verified: merged.verified }
      if (merged.spdx) clean.spdx = merged.spdx
      if (merged.url) clean.url = merged.url
      return { ...f, license: clean }
    })
  const presetId = PRESETS.find((p) => p.license.name === lic.name)?.id ?? (hasLicense ? 'custom' : '')
  const urlInvalid = urlText !== '' && !canParseUrl(urlText)

  const facts: Array<[string, string]> = [
    ['Family name', face.familyName],
    ['Style', face.styleName],
    ['Full name', `${face.familyName} ${face.styleName}`],
    ['PostScript name', psName(face.familyName, face.styleName)],
    ['Version', `Version ${FONT_VERSION}`],
    ['Copyright', face.copyright || 'not set'],
    ['Licence', hasLicense ? lic.name : 'not set'],
    ['Licence link', lic.url ?? 'not set'],
  ]

  return (
    <div className="grid max-w-3xl min-w-0 gap-8">
      <section aria-labelledby="info-names" className="grid gap-4">
        <div>
          <h2 id="info-names" className="text-lg font-bold">Names</h2>
          <p className="mt-1 text-sm text-ink-soft">Programs list fonts by these names. The PostScript name is built from the family and style with only letters, digits and hyphens.</p>
        </div>
        <Field id={ids.family} label="Family name" hint="Up to 100 characters. Names over 31 characters can be cut short in older programs.">
          <input id={ids.family} value={face.familyName} maxLength={100} onChange={(e) => update((f) => (e.target.value.trim() ? { ...f, familyName: e.target.value } : f))} className={`${inputClass} max-w-md`} />
        </Field>
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-ink-strong">Style</p>
          <p className="text-sm">{face.styleName}</p>
          <p className="text-xs text-ink-soft">This version writes every font as Regular (weight 400, upright), so the style cannot be changed. A bold or italic name on a Regular font would confuse font menus.</p>
        </div>
      </section>

      <section aria-labelledby="info-legal" className="grid gap-4">
        <div>
          <h2 id="info-legal" className="text-lg font-bold">Copyright and licence</h2>
          <p className="mt-1 text-sm text-ink-soft">These go into the font file so people who receive it know who made it and what they may do. Tynovo does not choose for you, check that a licence fits your situation, or give legal advice. The licence of this app is separate from the licence of fonts you make with it.</p>
        </div>
        <Field id={ids.copyright} label="Copyright notice" hint="For example “Copyright 2026 Your Name”. Up to 500 characters.">
          <input id={ids.copyright} value={face.copyright} maxLength={500} onChange={(e) => update((f) => ({ ...f, copyright: e.target.value }))} className={`${inputClass} max-w-xl`} />
        </Field>
        <Field id={ids.preset} label="Licence" hint="Choosing a licence fills in its name and link. Check the licence text yourself before relying on it.">
          <select
            id={ids.preset}
            value={presetId}
            onChange={(e) => {
              const p = PRESETS.find((x) => x.id === e.target.value)
              if (p) {
                setUrlText(p.license.url ?? '')
                update((f) => ({ ...f, license: { ...p.license, verified: false } }))
              } else if (e.target.value === '') {
                setUrlText('')
                update((f) => ({ ...f, license: { name: LICENSE_PLACEHOLDER, verified: false } }))
              } else setLicense({ verified: false })
            }}
            className={`${inputClass} max-w-md`}
          >
            <option value="">Not chosen yet</option>
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            <option value="custom">Other (write your own below)</option>
          </select>
        </Field>
        {hasLicense ? (
          <div className="grid gap-4">
            <Field id={ids.name} label="Licence name">
              <input id={ids.name} value={lic.name} maxLength={200} onChange={(e) => setLicense({ name: e.target.value })} className={`${inputClass} max-w-xl`} />
            </Field>
            <Field id={ids.url} label="Licence link" hint="Where people can read the full text.">
              <input
                id={ids.url}
                type="url"
                value={urlText}
                aria-invalid={urlInvalid || undefined}
                aria-describedby={urlInvalid ? `${ids.url}-err` : undefined}
                onChange={(e) => {
                  setUrlText(e.target.value)
                  if (e.target.value === '' || canParseUrl(e.target.value)) setLicense({ url: e.target.value })
                }}
                className={`${inputClass} max-w-xl aria-invalid:border-danger`}
              />
              {urlInvalid ? <span id={`${ids.url}-err`} className="text-xs text-danger">Enter a full web address starting with https://</span> : null}
            </Field>
            <Field id={ids.spdx} label="SPDX identifier (optional)" hint="A standard short code such as OFL-1.1. Kept in the project; the font file has the name and link.">
              <input id={ids.spdx} value={lic.spdx ?? ''} maxLength={100} onChange={(e) => setLicense({ spdx: e.target.value })} className={`${inputClass} max-w-xs`} />
            </Field>
            <label className="flex min-h-11 max-w-xl items-start gap-2 text-sm md:min-h-9">
              <input type="checkbox" checked={lic.verified} onChange={(e) => setLicense({ verified: e.target.checked })} className="mt-1 size-4 accent-accent" />
              <span><strong className="text-ink-strong">I have read this licence and chosen it for this typeface.</strong> Recorded in the project; it is not a legal check.</span>
            </label>
          </div>
        ) : (
          <Banner tone="warn">No licence is set, so exported fonts carry no licence information.</Banner>
        )}
      </section>

      <section aria-labelledby="info-file" className="grid gap-3">
        <div>
          <h2 id="info-file" className="text-lg font-bold">What the file will say</h2>
          <p className="mt-1 text-sm text-ink-soft">The values below are what the name table receives. After export Tynovo reads the file again and compares these fields with the file.</p>
        </div>
        <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-ink-strong">{k}</dt>
              <dd className="min-w-0 break-words text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
