import * as Y from 'yjs'

import {DocConfig, EditorUser, LockInfo, LockType, docConfigKeys} from '../types'
import {safeYjsMapGet, safeYjsMapSet} from './yJsHelpers'

export function getLockInfo(
  docConfig: Y.Map<DocConfig>,
  lockType: LockType,
  sectionName?: string,
): LockInfo {
  const keys = sectionName
    ? docConfigKeys.sections(sectionName)[lockType]
    : docConfigKeys.doc[lockType]

  return {
    active: safeYjsMapGet<boolean>(docConfig, keys.active) || false,
    userId: safeYjsMapGet<string>(docConfig, keys.userId),
    userName: safeYjsMapGet<string>(docConfig, keys.userName),
    timestamp: safeYjsMapGet<string>(docConfig, keys.timestamp),
  }
}

export function setLockInfo(
  docConfig: Y.Map<DocConfig>,
  lockType: LockType,
  active: boolean,
  user: EditorUser,
  sectionName?: string,
) {
  const keys = sectionName
    ? docConfigKeys.sections(sectionName)[lockType]
    : docConfigKeys.doc[lockType]

  safeYjsMapSet(docConfig, keys.active, active)

  if (active) {
    safeYjsMapSet(docConfig, keys.userId, user.id)
    safeYjsMapSet(docConfig, keys.userName, user.name)
    safeYjsMapSet(docConfig, keys.timestamp, new Date().toISOString())
  } else {
    safeYjsMapSet(docConfig, keys.userId, undefined)
    safeYjsMapSet(docConfig, keys.userName, undefined)
    safeYjsMapSet(docConfig, keys.timestamp, undefined)
  }
}

export function getCanActivateLock(
  docConfig: Y.Map<DocConfig>,
  lockType: LockType,
  sectionName?: string,
): boolean {
  const oppositeLockType = lockType === LockType.UserLock ? LockType.AiEdit : LockType.UserLock

  const docUserLock = getLockInfo(docConfig, LockType.UserLock)
  const docAiEdit = getLockInfo(docConfig, LockType.AiEdit)

  if (docUserLock.active || docAiEdit.active) return false

  if (sectionName) {
    const sectionOpposite = getLockInfo(docConfig, oppositeLockType, sectionName)
    if (sectionOpposite.active) return false
  }

  return true
}

export function getIsEditable(
  docConfig: Y.Map<DocConfig>,
  sectionName: string,
  user: EditorUser,
): boolean {
  const docUserLock = getLockInfo(docConfig, LockType.UserLock)
  const docAiEdit = getLockInfo(docConfig, LockType.AiEdit)

  // users who triggered an AI edit can continue editing
  if (docUserLock.active || (docAiEdit.active && docAiEdit.userId !== user.id)) return false

  const sectionUserLock = getLockInfo(docConfig, LockType.UserLock, sectionName)
  const sectionAiEdit = getLockInfo(docConfig, LockType.AiEdit, sectionName)

  // users who triggered an AI edit can continue editing
  if (sectionUserLock.active || (sectionAiEdit.active && sectionAiEdit.userId !== user.id))
    return false

  return true
}
