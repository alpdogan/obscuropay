export function paymentRequiredTelegramText(amount: string, asset: string): string {
  return `This request costs ${amount} ${asset}. Pay on Obscurus checkout, then this chat continues automatically.`;
}

export function resultTelegramText(output: string | null): string {
  const text = output?.trim() ?? "";
  return text.length > 0 ? text : "Paid request completed.";
}

export function unknownCommandTelegramText(command: string): string {
  return `Unknown command. Use /${command} and the value this endpoint expects.`;
}
