import type { TeamKind } from './types';

// Public-facing copy adapted from the 2027 Board of Executives Plan Guidelines.
// The guidelines are planning prompts; these summaries describe each team's focus.
const descriptions: Record<Exclude<TeamKind, 'other'>, string> = {
  coaching: 'Helps speakers shape and deliver their ideas with clarity. Builds a structured coaching process and works closely with Research and Production to prepare talks for the TEDxGUC stage.',
  research_production: 'Researches the ideas behind our talks and develops a clear process for preparing their content. Works with Coaching to keep research and talk preparation aligned throughout the season.',
  logistics_planning: 'Plans and runs TEDxGUC events throughout the year, from dates and venues to main-event ushering. Coordinates attendee and associate packs, along with the suppliers needed to bring each experience together.',
  partnerships: 'Builds relationships with potential partners and develops approaches for working together. Works on community benefits through partner perks, discounts and loyalty-card initiatives.',
  associates_experience: 'Keeps the TEDxGUC community active, connected and engaged. Designs collaborative camp activities, follows participation in workshops and events, and develops initiatives that connect associates with each other and the wider community.',
  associates_development: "Supports associates' skills and professional growth. Tracks attendance, task completion and progress, and helps make camp and learning activities productive opportunities to develop.",
  campaigns_copyrights: "Shapes TEDxGUC's brand image and plans campaigns that connect our events with their audiences. Brings on-ground and social-media activity together, with a focus on clear messaging and wider reach.",
  media_design: "Develops the season's visual direction through colour, typography and imagery. Creates design projects and proposes workshops that help associates build creative skills and bring TEDxGUC's identity to life.",
};

export function teamDescription(kind: TeamKind): string | null {
  return kind === 'other' ? null : descriptions[kind];
}
