import jsonwebtoken from 'jsonwebtoken'

import {CollabEditor} from '@/components/specific/TipTapMultiSection'

export default function App() {
  const userId = `user_${Math.round(Math.random() * 1000)}`
  const userName = `User ${userId.split('_')[1]}`
  const userData = {sub: userId}

  const docToken = jsonwebtoken.sign(userData, process.env.TIPTAP_CLOUD_DEV_DOC_SECRET || '')
  const aiToken = jsonwebtoken.sign(userData, process.env.TIPTAP_CLOUD_DEV_AI_SECRET || '')

  const document = {
    name: 'dev.document9',
    sections: Array.from({length: 20}, (_, i) => `section-${i + 1}`),
  }

  return (
    <div className="flex max-h-screen flex-1 p-4">
      <CollabEditor
        docAppId={process.env.TIPTAP_CLOUD_DEV_DOC_APP_ID || ''}
        aiAppId={process.env.TIPTAP_CLOUD_DEV_AI_APP_ID || ''}
        document={document}
        user={{
          id: userId,
          name: userName,
          color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          docToken,
          aiToken,
        }}
        className="flex-1"
      />
    </div>
  )
}
