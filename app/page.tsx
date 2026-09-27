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
          <GraduationCap size={30} /> AcadPath<span>STUDENT WORKSPACE</span>
        </div>
        <p className="eyebrow">YOUR DEGREE, WITH DIRECTION</p>
        <h1>
          Make your next
          <br />
          semester count.
        </h1>
        <p className="lede">
          Turn your curriculum into a clear academic roadmap. Know what is
          complete, what is next, and what gets you there.
        </p>
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
            ? 'Development mode: one local student profile. Hosted accounts use secure sign-in.'
            : 'Your academic record is private to your account.'}
        </p>
        <div className="login-features">
          <span>
            <GitBranch />
            Understand your prerequisites
          </span>
          <span>
            <CalendarDays />
            Plan a realistic path to graduation
          </span>
        </div>
      </section>
      <aside className="login-note">
        <p className="eyebrow">A CLEARER PATH FORWARD</p>
        <h2>
          Small decisions.
          <br />A bigger picture.
        </h2>
        <div className="path-line">
          <span>01</span>
          <p>Import your curriculum</p>
          <span>02</span>
          <p>Mark your progress</p>
          <span>03</span>
          <p>Plan what comes next</p>
        </div>
        <p>
          Built around your subjects and their actual prerequisite
          relationships.
        </p>
      </aside>
    </main>
  );
}
