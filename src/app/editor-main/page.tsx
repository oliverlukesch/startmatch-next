import jsonwebtoken from 'jsonwebtoken'

import {CollabEditor} from '@/components/specific/BlockNoteMultiField'

export default function App() {
  const userName = `user_${Math.round(Math.random() * 1000)}`
  const userData = {sub: userName}
  const userToken = jsonwebtoken.sign(userData, process.env.TIPTAP_CLOUD_DEV_APP_SECRET || '')

  const document = {
    name: 'dev.document8',
    fields: Array.from({length: 20}, (_, i) => `section-${i + 1}`),
  }

  return (
    <div className="flex max-h-screen flex-1 p-4">
      <CollabEditor
        appId={process.env.TIPTAP_CLOUD_DEV_APP_ID || ''}
        document={document}
        user={{
          name: userName,
          color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          token: userToken,
        }}
        className="flex-1"
      />
    </div>
  )
}
