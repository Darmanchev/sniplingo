export function appendStaticMarkup(
  root: ShadowRoot,
  markup: string,
): void {
  const documentFragment = new DOMParser().parseFromString(
    `<body>${markup}</body>`,
    'text/html',
  );
  root.append(...Array.from(documentFragment.body.childNodes));
}
