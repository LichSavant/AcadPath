import { requireChatGPTUser } from '@/app/chatgpt-auth';
import AcadPath from '@/components/academic/acadpath';
export const dynamic = 'force-dynamic';
export default async function Workspace() {
  const user = await requireChatGPTUser('/workspace');
  return (
    <AcadPath
      name={user.fullName ?? user.email}
      local={process.env.NODE_ENV === 'development'}
    />
  );
}
