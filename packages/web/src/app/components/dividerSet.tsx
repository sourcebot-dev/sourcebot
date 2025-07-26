import { Fragment } from "react";
import { TextSeparator } from "./textSeparator";

export const DividerSet = ({ elements }: { elements: React.ReactNode[] }) => {
    return elements.map((child, index) => {
        return (
            <Fragment key={index}>
                {child}
                {index < elements.length - 1 && <TextSeparator key={`divider-${index}`} />}
            </Fragment>
        );
    });
}; 