import { Component, type ReactNode } from 'react'
import i18n from '../i18n'

type Props = { children: ReactNode }
type State = { hasError: boolean }

/** Catches render/runtime crashes in a subtree and shows a recover option
 *  instead of a blank screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Caught by ErrorBoundary:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-slate-300">{i18n.t('common.error')}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
          >
            {i18n.t('scan.tryAgain')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
