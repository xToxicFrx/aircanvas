import { CameraStage } from './components/CameraStage'

export default function App() {
  return (
    <div className="flex min-h-full flex-col items-center gap-6 bg-zinc-950 px-4 py-10 text-white">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Air<span className="text-amber-400">Canvas</span>
        </h1>
        <p className="mt-2 text-zinc-400">
          Daumen und Zeigefinger zusammendrücken = zeichnen. Loslassen = Stift absetzen.
        </p>
      </header>
      <CameraStage />
      <footer className="text-sm text-zinc-500">
        Alles läuft lokal in deinem Browser — kein Video verlässt dein Gerät.
      </footer>
    </div>
  )
}
