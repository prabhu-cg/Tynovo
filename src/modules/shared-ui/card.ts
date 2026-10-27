/**
 * A card, as Doxa draws it. Default: 16px radius, white, hairline border, soft shadow. Hover (and keyboard focus inside):
 * the border turns primary, the shadow lifts and the card rises 2px over 200ms. The rise is off under reduced motion.
 * Keyboard focus is shown by the focused control's own outline plus the primary border, so it never relies on a faint ring.
 */
export const cardClass =
  'rounded-card border border-line bg-paper p-5 shadow-card transition-[border-color,box-shadow,transform] duration-200 ' +
  'hover:-translate-y-0.5 hover:border-accent hover:shadow-lift has-focus-visible:border-accent has-focus-visible:shadow-lift motion-reduce:hover:translate-y-0'
