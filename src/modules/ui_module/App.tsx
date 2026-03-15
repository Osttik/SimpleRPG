import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '../store_module'
import { increment, decrement } from '../store_module/slices/counterSlice'

function App() {
  const count = useSelector((state: RootState) => state.counter.value)
  const dispatch = useDispatch()

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
      <h1 className="text-4xl font-bold mb-8 text-blue-400 drop-shadow-lg">
        SimpleRPG Initialized
      </h1>

      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 flex flex-col items-center">
        <p className="text-xl mb-6">Redux Counter State:
          <span className="ml-2 font-mono text-yellow-400 font-bold">{count}</span>
        </p>

        <div className="flex gap-4">
          <button
            onClick={() => dispatch(decrement())}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-semibold transition-all active:scale-95"
          >
            Decrease
          </button>
          <button
            onClick={() => dispatch(increment())}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-all active:scale-95"
          >
            Increase
          </button>
        </div>
      </div>

      <div className="mt-12 text-slate-400 text-sm flex gap-4">
        <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700">TypeScript</span>
        <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700">React</span>
        <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700">Redux Toolkit</span>
        <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700">Tailwind CSS</span>
        <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700">SCSS</span>
      </div>
    </div>
  )
}

export default App
