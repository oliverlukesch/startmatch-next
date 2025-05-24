export interface EditorUser {
  id: string
  name: string
  color: string
  docToken: string
  aiToken: string
}

export enum LockType {
  UserLock = 'userLock',
  AiEdit = 'aiEdit',
}

export interface LockInfo {
  active: boolean
  userId?: string
  userName?: string
  timestamp?: string
}

export interface DocConfig {
  // document-level config
  'doc.userLock.active': boolean
  'doc.userLock.userId'?: string
  'doc.userLock.userName'?: string
  'doc.userLock.timestamp'?: string
  'doc.aiEdit.active': boolean
  'doc.aiEdit.userId'?: string
  'doc.aiEdit.userName'?: string
  'doc.aiEdit.timestamp'?: string

  // section-level config are dynamic and added with pattern:
  // 'sections.[sectionName].userLock.active': boolean
  // 'sections.[sectionName].userLock.userId': string
  // etc...
  [key: string]: boolean | string | undefined
}

export const docConfigKeys = {
  mapName: '__startmatch__config',
  doc: {
    userLock: {
      active: 'doc.userLock.active',
      userId: 'doc.userLock.userId',
      userName: 'doc.userLock.userName',
      timestamp: 'doc.userLock.timestamp',
    },
    aiEdit: {
      active: 'doc.aiEdit.active',
      userId: 'doc.aiEdit.userId',
      userName: 'doc.aiEdit.userName',
      timestamp: 'doc.aiEdit.timestamp',
    },
  },
  sections: (sectionName: string) => ({
    userLock: {
      active: `sections.${sectionName}.userLock.active`,
      userId: `sections.${sectionName}.userLock.userId`,
      userName: `sections.${sectionName}.userLock.userName`,
      timestamp: `sections.${sectionName}.userLock.timestamp`,
    },
    aiEdit: {
      active: `sections.${sectionName}.aiEdit.active`,
      userId: `sections.${sectionName}.aiEdit.userId`,
      userName: `sections.${sectionName}.aiEdit.userName`,
      timestamp: `sections.${sectionName}.aiEdit.timestamp`,
    },
  }),
}
