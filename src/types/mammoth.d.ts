declare module 'mammoth' {
  export interface MammothResult {
    value: string;
    messages: any[];
  }
  export function extractRawText(input: { buffer?: Buffer; path?: string; arrayBuffer?: ArrayBuffer }): Promise<MammothResult>;
  export function convertToHtml(input: { buffer?: Buffer; path?: string }): Promise<MammothResult>;
  const mammoth: {
    extractRawText: typeof extractRawText;
    convertToHtml: typeof convertToHtml;
  };
  export default mammoth;
}
