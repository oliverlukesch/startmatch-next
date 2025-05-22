import * as Y from 'yjs'

import {DocSettings, LockInfo, docSettingsKeys} from './types'
import {safeYjsMapGet, safeYjsMapSet} from './utils'

export function getLockInfo(
  docSettings: Y.Map<DocSettings> | undefined,
  lockType: 'userLock' | 'aiEdit',
  sectionName?: string,
): LockInfo {
  if (!docSettings) {
    return {active: false}
  }

  const keys = sectionName
    ? docSettingsKeys.sections(sectionName)[lockType]
    : docSettingsKeys.doc[lockType]

  return {
    active: safeYjsMapGet<boolean>(docSettings, keys.active) || false,
    userId: safeYjsMapGet<string>(docSettings, keys.userId),
    userName: safeYjsMapGet<string>(docSettings, keys.userName),
    timestamp: safeYjsMapGet<string>(docSettings, keys.timestamp),
  }
}

export function setLockInfo(
  docSettings: Y.Map<DocSettings> | undefined,
  lockType: 'userLock' | 'aiEdit',
  active: boolean,
  user: {userId: string; name: string},
  sectionName?: string,
) {
  if (!docSettings) return

  const keys = sectionName
    ? docSettingsKeys.sections(sectionName)[lockType]
    : docSettingsKeys.doc[lockType]

  safeYjsMapSet(docSettings, keys.active, active)
  if (active) {
    safeYjsMapSet(docSettings, keys.userId, user.userId)
    safeYjsMapSet(docSettings, keys.userName, user.name)
    safeYjsMapSet(docSettings, keys.timestamp, new Date().toISOString())
  } else {
    // clear user info when deactivating
    safeYjsMapSet(docSettings, keys.userId, undefined)
    safeYjsMapSet(docSettings, keys.userName, undefined)
    safeYjsMapSet(docSettings, keys.timestamp, undefined)
  }
}

export function canActivateLock(
  docSettings: Y.Map<DocSettings> | undefined,
  lockType: 'userLock' | 'aiEdit',
  sectionName?: string,
): boolean {
  if (!docSettings) return false

  // check if opposite lock type is active
  const oppositeLockType = lockType === 'userLock' ? 'aiEdit' : 'userLock'

  // check document-level locks
  const docUserLock = getLockInfo(docSettings, 'userLock')
  const docAiEdit = getLockInfo(docSettings, 'aiEdit')

  if (docUserLock.active || docAiEdit.active) {
    return false
  }

  // if checking for section, also check section-level opposite lock
  if (sectionName) {
    const sectionOpposite = getLockInfo(docSettings, oppositeLockType, sectionName)
    if (sectionOpposite.active) {
      return false
    }
  }

  return true
}

export function isEditable(
  docSettings: Y.Map<DocSettings> | undefined,
  currentUserId: string,
  sectionName?: string,
): boolean {
  if (!docSettings) return true

  // check document-level locks
  const docUserLock = getLockInfo(docSettings, 'userLock')
  const docAiEdit = getLockInfo(docSettings, 'aiEdit')

  if (docUserLock.active && docUserLock.userId !== currentUserId) {
    return false
  }

  if (docAiEdit.active) {
    return false
  }

  // check section-level locks if applicable
  if (sectionName) {
    const sectionUserLock = getLockInfo(docSettings, 'userLock', sectionName)
    const sectionAiEdit = getLockInfo(docSettings, 'aiEdit', sectionName)

    if (sectionUserLock.active && sectionUserLock.userId !== currentUserId) {
      return false
    }

    if (sectionAiEdit.active) {
      return false
    }
  }

  return true
}
