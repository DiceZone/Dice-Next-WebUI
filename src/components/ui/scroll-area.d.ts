import * as React from 'react';
interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
    orientation?: 'vertical' | 'horizontal' | 'both';
}
declare const ScrollArea: React.ForwardRefExoticComponent<ScrollAreaProps & React.RefAttributes<HTMLDivElement>>;
export { ScrollArea };
