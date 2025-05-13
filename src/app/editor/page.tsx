import jsonwebtoken from 'jsonwebtoken'

import {CollabEditor} from '@/components/specific/CollabEditor'

export default function App() {
  const userName = `user_${Math.round(Math.random() * 1000)}`
  const userData = {sub: userName}
  const userToken = jsonwebtoken.sign(userData, process.env.TIPTAP_CLOUD_DEV_APP_SECRET || '')

  return (
    <>
      <div>User name: {userName}</div>
      <CollabEditor
        appId={process.env.TIPTAP_CLOUD_DEV_APP_ID || ''}
        documentName="dev.document"
        user={{
          name: userName,
          color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          token: userToken,
        }}
        className="m-8 min-h-80"
      />
    </>
  )
}
