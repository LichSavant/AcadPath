import { getChatGPTUser, chatGPTSignInPath } from './chatgpt-auth';
import { redirect } from 'next/navigation';
import {
  GraduationCap,
  ArrowRight,
  GitBranch,
  CalendarDays,
} from 'lucide-react';
export const dynamic = 'force-dynamic';
export default async function Home() {
  if (await getChatGPTUser()) redirect('/workspace');
  const local = process.env.NODE_ENV === 'development';
  return (
    <main className="login">
      <section className="login-card">
        <div className="brand">
          <GraduationCap size={30} /> AcadPath
          <span>University of San Carlos</span>
        </div>
        <p className="eyebrow">ACADEMIC PATHWAY PLANNER · USC CEBU</p>
        <h1>Welcome to AcadPath</h1>
        <p className="lede">Plan your USC academic journey.</p>
        <a
          className="primary-link"
          href={local ? '/workspace' : chatGPTSignInPath('/workspace')}
          target="_top"
        >
          {local ? 'Open local workspace' : 'Sign in with ChatGPT'}{' '}
          <ArrowRight size={18} />
        </a>
        <p className="muted">
          {local
            ? 'Local development profile.'
            : 'Your academic record is private to your account.'}
        </p>
        <div className="login-features">
          <span>
            <GitBranch />
            Check prerequisites
          </span>
          <span>
            <CalendarDays />
            Plan your semesters
          </span>
        </div>
      </section>
      <aside className="login-note">
        <p className="eyebrow">A CLEARER PATH FORWARD</p>
        <h2>Your path, step by step.</h2>
        <div className="path-line">
          <span>01</span>
          <p>Upload your prospectus</p>
          <span>02</span>
          <p>Mark your progress</p>
          <span>03</span>
          <p>Plan what comes next</p>
        </div>
      </aside>
    </main>
  );
}
