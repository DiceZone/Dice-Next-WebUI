import * as React from 'react';
interface AccordionProps {
    type: 'single' | 'multiple';
    collapsible?: boolean;
    defaultValue?: string[];
    value?: string[];
    onValueChange?: (value: string[]) => void;
    className?: string;
    children: React.ReactNode;
}
declare function Accordion({ type, collapsible, defaultValue, value: controlledValue, onValueChange, className, children, }: AccordionProps): React.JSX.Element;
declare namespace Accordion {
    var displayName: string;
}
interface AccordionItemProps {
    value: string;
    className?: string;
    children: React.ReactNode;
}
declare function AccordionItem({ value, className, children }: AccordionItemProps): React.JSX.Element;
declare namespace AccordionItem {
    var displayName: string;
}
interface AccordionTriggerProps {
    className?: string;
    children: React.ReactNode;
}
declare function AccordionTrigger({ className, children }: AccordionTriggerProps): React.JSX.Element;
declare namespace AccordionTrigger {
    var displayName: string;
}
interface AccordionContentProps {
    className?: string;
    children: React.ReactNode;
}
declare function AccordionContent({ className, children }: AccordionContentProps): React.JSX.Element;
declare namespace AccordionContent {
    var displayName: string;
}
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
