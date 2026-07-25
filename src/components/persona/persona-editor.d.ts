/**
 * C#28-B: Persona Editor — inline key→value editing for persona entries
 */
import React from 'react';
import type { PersonaTemplate } from '@/types/persona';
interface Props {
    persona: PersonaTemplate;
    onClose: () => void;
    onChanged: () => void;
}
export declare const PersonaEditor: React.FC<Props>;
export default PersonaEditor;
