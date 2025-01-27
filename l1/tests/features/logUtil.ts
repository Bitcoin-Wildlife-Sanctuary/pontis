
export function createLogger(prefix: string) {
    return {
        info: (...args: any[]) => {
            let logPrefix = `%c[${prefix}]`
            let leftArgs = args;
            if (typeof args[0] === 'string' && args.length > 1) {
                logPrefix += ` ${args[0]}`
                leftArgs = args.slice(1)
            }
            const style = 'color: #ecf6fd; font-weight: bold;'
            console.log(logPrefix, style, ...leftArgs)
        }
    }
}