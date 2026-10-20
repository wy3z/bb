import { useCallback } from "react";
import {
  NewThreadComposer,
  type NewThreadComposerSubmission,
} from "@/components/promptbox/NewThreadComposer";
import { useCreateThread } from "@/hooks/mutations/thread-runtime-mutations";
import { useLinkThreadToWorkspace } from "@/components/secondary-panel/threadWorkspace";

interface MainPaneNewAgentProps {
  environmentId: string;
  onCreated: (thread: { id: string; projectId: string }) => void;
  projectId: string;
  workspaceThreadId: string;
}

const noopProjectChange = () => {};

export function MainPaneNewAgent({
  environmentId,
  onCreated,
  projectId,
  workspaceThreadId,
}: MainPaneNewAgentProps) {
  const createThread = useCreateThread();
  const linkThreadToWorkspace = useLinkThreadToWorkspace();
  const handleSubmit = useCallback(
    async (request: NewThreadComposerSubmission) => {
      const { sendAt, ...requestFields } = request;
      const thread = await createThread.mutateAsync({
        ...requestFields,
        ...(sendAt === undefined ? {} : { sendAt }),
      });
      linkThreadToWorkspace(thread.id, workspaceThreadId);
      onCreated(thread);
    },
    [createThread, linkThreadToWorkspace, onCreated, workspaceThreadId],
  );

  return (
    <NewThreadComposer
      projectId={projectId}
      onProjectChange={noopProjectChange}
      draftStorage={{
        kind: "workspace-new-thread",
        threadId: workspaceThreadId,
      }}
      selectionScope="component-local"
      seed={{ environment: { type: "reuse", environmentId } }}
      resetKey={workspaceThreadId}
      focusRequest={1}
      onSubmit={handleSubmit}
    >
      {({ renderPromptBox }) => (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto p-6">
          <div className="flex w-full max-w-3xl flex-col gap-2">
            <div className="text-sm font-medium text-foreground">New agent</div>
            {renderPromptBox({
              placeholder: "What should this agent do?",
              mentionMenuPlacement: "bottom",
            })}
          </div>
        </div>
      )}
    </NewThreadComposer>
  );
}
