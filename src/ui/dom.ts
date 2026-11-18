type Child = Node | string | null | false | undefined;

/** Tiny element factory: `el('div.card.wide', 'text', child)`. */
type TagOf<S extends string> = S extends `${infer T}.${string}` ? T : S;
type ElementOf<S extends string> = TagOf<S> extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[TagOf<S>] : HTMLElement;

export function el<S extends string>(spec: S, ...children: Child[]): ElementOf<S> {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag) as ElementOf<S>;
  if (classes.length) node.className = classes.join(' ');
  for (const c of children) if (c) node.append(c);
  return node;
}

export function button(label: string, onClick: () => void, variant = ''): HTMLButtonElement {
  const b = el('button.btn', label);
  if (variant) b.classList.add(...variant.split(' '));
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** Segmented control for choosing one of a few labelled values. */
export function choice<T extends string | number>(
  label: string, options: readonly { value: T; label: string }[], current: T, onChange: (value: T) => void,
): HTMLElement {
  const group = el('div.seg');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', label);
  const buttons = options.map((o) => {
    const b = el('button.seg-btn', o.label);
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => {
      select(o.value);
      onChange(o.value);
    });
    group.append(b);
    return { b, value: o.value };
  });
  const select = (value: T): void => {
    for (const { b, value: v } of buttons) {
      b.classList.toggle('on', v === value);
      b.setAttribute('aria-checked', String(v === value));
    }
  };
  select(current);
  return el('div.field', el('span.field-label', label), group);
}
