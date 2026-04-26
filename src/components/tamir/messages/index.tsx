import TextBubble from './TextBubble';
import ActionConfirmation from './ActionConfirmation';
import PlanningQuestions from './PlanningQuestions';
import MissionBriefSummary from './MissionBriefSummary';
import LiveExecutionPanel from './LiveExecutionPanel';
import HandoffCTA from './HandoffCTA';
import EscalationAlert from './EscalationAlert';
import AgentDeliverable from './AgentDeliverable';

export type MessageType =
  | 'text'
  | 'action_confirmation'
  | 'planning_questions'
  | 'mission_brief'
  | 'live_execution'
  | 'handoff'
  | 'escalation'
  | 'agent_deliverable';

const MESSAGE_COMPONENTS: Record<MessageType, React.ComponentType<any>> = {
  text: TextBubble,
  action_confirmation: ActionConfirmation,
  planning_questions: PlanningQuestions,
  mission_brief: MissionBriefSummary,
  live_execution: LiveExecutionPanel,
  handoff: HandoffCTA,
  escalation: EscalationAlert,
  agent_deliverable: AgentDeliverable,
};

export function MessageRenderer({
  type,
  ...props
}: {
  type: MessageType;
  [key: string]: unknown;
}) {
  const Component = MESSAGE_COMPONENTS[type];
  if (!Component) {
    return <TextBubble content={String(props.content ?? '')} role="agent" />;
  }
  return <Component {...props} />;
}

export {
  TextBubble,
  ActionConfirmation,
  PlanningQuestions,
  MissionBriefSummary,
  LiveExecutionPanel,
  HandoffCTA,
  EscalationAlert,
  AgentDeliverable,
};
