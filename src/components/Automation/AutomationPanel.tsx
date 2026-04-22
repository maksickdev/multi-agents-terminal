import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAutomationStore } from '../../store/useAutomationStore';
import { AutomationList } from './AutomationList';
import { AutomationLogList } from './AutomationLogList';
import { AutomationForm } from './AutomationForm';
import type { Automation } from '../../types/automation';

export function AutomationPanel() {
  const {
    automationPanelOpen,
    automationPanelWidth,
    setAutomationPanelWidth,
    selectedProjectId,
  } = useStore();
  const { automations, logs } = useAutomationStore();

  const [showForm, setShowForm] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);

  // Resize handle
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWRef = useRef(0);

  function onResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWRef.current = automationPanelWidth;

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startXRef.current - ev.clientX;
      setAutomationPanelWidth(startWRef.current + delta);
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function openCreate() {
    setEditingAutomation(null);
    setShowForm(true);
  }

  function openEdit(a: Automation) {
    setEditingAutomation(a);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingAutomation(null);
  }

  const projectId = selectedProjectId ?? '';
  const projectAutomations = automations.filter((a) => a.projectId === projectId);
  const projectLogs = logs.filter((l) => l.projectId === projectId);

  return (
    <>
      <div
        style={{
          width: automationPanelOpen ? automationPanelWidth : 0,
          flexShrink: 0,
          overflow: 'hidden',
          position: 'relative',
          ...(automationPanelOpen
            ? {
                borderRadius: 10,
                marginTop: 4,
                marginBottom: 4,
                marginRight: 4,
                border: '1px solid var(--c-border)',
              }
            : {}),
        }}
      >
        {automationPanelOpen && (
          <>
            {/* Resize handle on the left edge */}
            <div
              onMouseDown={onResizeMouseDown}
              className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize z-10 hover:bg-[var(--c-accent)]/30 transition-colors"
            />

            <div className="flex flex-col h-full bg-[var(--c-bg)] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-3 h-8 flex-shrink-0 border-b border-[var(--c-border)]">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--c-text-dim)]">
                  Automation
                </span>
                {projectId && (
                  <button
                    onClick={openCreate}
                    title="New automation"
                    className="flex items-center gap-1 text-xs text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>

              {!projectId ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-[var(--c-text-dim)]">Select a project first.</p>
                </div>
              ) : (
                <>
                  <AutomationList automations={projectAutomations} onEdit={openEdit} />
                  <AutomationLogList logs={projectLogs} />
                </>
              )}
            </div>
          </>
        )}
      </div>

      {showForm && projectId && (
        <AutomationForm
          projectId={projectId}
          automation={editingAutomation}
          onClose={closeForm}
        />
      )}
    </>
  );
}
