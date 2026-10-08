import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useSyncExternalStore } from "react"

function subscribePanelTemplate(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-panel-template"],
  })
  return () => observer.disconnect()
}

function getPanelTemplateId() {
  return document.documentElement.dataset.panelTemplate ?? ""
}

export function Toaster() {
  const { toasts } = useToast()
  const panelTemplateId = useSyncExternalStore(
    subscribePanelTemplate,
    getPanelTemplateId,
    () => "",
  )
  const isNova =
    panelTemplateId === "ratehonk-v1" || panelTemplateId === "helicoptic-v1"

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast
            key={id}
            {...props}
            style={
              isNova
                ? {
                    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
                  }
                : undefined
            }
          >
            <div className="grid gap-1 min-w-0 flex-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
