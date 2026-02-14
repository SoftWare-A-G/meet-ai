import { Toast } from '@base-ui/react/toast'

function ToastList() {
  const { toasts } = Toast.useToastManager()

  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed bottom-20 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map(toast => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="bg-[#3FB950] text-black px-5 py-2.5 rounded-lg text-sm font-semibold pointer-events-none animate-toast-fade"
          >
            <Toast.Description>{toast.description}</Toast.Description>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

export { ToastList }
