import * as React from "react"

interface SessionTimeProps extends React.ComponentProps<'input'> {
    isoStrStart: string;
    isoStrEnd: string;
}

const SessionTime = React.forwardRef<HTMLInputElement, SessionTimeProps>(
    ({ className, isoStrStart, isoStrEnd, ...props }, ref) => {

        /** Formatea "2026-04-21T19:00:00Z" → "19:00" */
        const formatSessionTime = (isStr: string) =>
            new Date(isStr).toLocaleTimeString("es-CL", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
            });
        return (
            <p>{formatSessionTime(isoStrStart)} - {formatSessionTime(isoStrEnd)}</p>
        )
    }
)
SessionTime.displayName = "SessionTime"

export { SessionTime }
