export declare function SettingsPanel(): import("react").JSX.Element;
interface ClientContext {
    slots: {
        inject(name: string, callback: () => unknown): unknown;
        register(options: {
            name: string;
            id: string;
            order: number;
            label: string;
        }, component: typeof SettingsPanel): unknown;
    };
}
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
export {};
