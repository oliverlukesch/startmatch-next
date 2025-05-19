import jsonwebtoken from 'jsonwebtoken'

import {TipTapMultiField} from '@/components/specific/TipTapMultiField'

export default function App() {
  const userName = `user_${Math.round(Math.random() * 1000)}`
  const userData = {sub: userName}
  const userToken = jsonwebtoken.sign(userData, process.env.TIPTAP_CLOUD_DEV_APP_SECRET || '')

  const document = {
    name: 'dev.document5',
    fields: Array.from({length: 20}, (_, i) => `section-${i + 1}`),
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-2xl font-semibold">User name: {userName}</h2>
      <TipTapMultiField
        appId={process.env.TIPTAP_CLOUD_DEV_APP_ID || ''}
        document={document}
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
