import jsonwebtoken from 'jsonwebtoken'

import {BlockNoteMultiField} from '@/components/specific/BlockNoteMultiField'

export default function App() {
  const userName = `user_${Math.round(Math.random() * 1000)}`
  const userData = {sub: userName}
  const userToken = jsonwebtoken.sign(userData, process.env.TIPTAP_CLOUD_DEV_APP_SECRET || '')

  const documentFields = Array.from({length: 10}, (_, i) => `section-${i + 1}`)

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-2xl font-semibold">User name: {userName}</h2>
      <BlockNoteMultiField
        appId={process.env.TIPTAP_CLOUD_DEV_APP_ID || ''}
        documentName="dev.document"
        documentFields={documentFields}
        user={{
          name: userName,
          color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          token: userToken,
        }}
        className="min-h-80"
      />
    </div>
  )
}
