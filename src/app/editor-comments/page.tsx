import jsonwebtoken from 'jsonwebtoken'

import CollabEditor from '@/components/specific/TipTapWithCommentsTs'

export default function App() {
  const userName = `comment_user_${Math.round(Math.random() * 1000)}`
  const userData = {sub: userName}
  const userToken = jsonwebtoken.sign(userData, process.env.TIPTAP_CLOUD_DEV_APP_SECRET || '')

  return (
    <div className="flex flex-col gap-4 p-4">
      <CollabEditor
        appId={process.env.TIPTAP_CLOUD_DEV_APP_ID || ''}
        documentName="dev.comments.document4"
        user={{
          name: userName,
          color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
          token: userToken,
        }}
      />
    </div>
  )
}
