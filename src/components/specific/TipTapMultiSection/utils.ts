import * as Y from 'yjs'

// YJS library is wrongly typed, this is a workaround
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeYjsMapGet<T>(map: Y.Map<any>, key: string): T {
  return map.get(key) as T
}

// YJS library is wrongly typed, this is a workaround
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeYjsMapSet(map: Y.Map<any>, key: string, value: any) {
  map.set(key, value)
}

export function getOrCreateSubXmlFragment(doc: Y.Doc, name: string): Y.XmlFragment {
  const defaultMap = doc.getMap('default')
  let subFragment = defaultMap.get(name) as Y.XmlFragment

  if (!subFragment || !(subFragment instanceof Y.XmlFragment)) {
    subFragment = new Y.XmlFragment()
    defaultMap.set(name, subFragment)
  }

  return subFragment
}
