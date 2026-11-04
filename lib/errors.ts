// Specific error messages matching 56-cutline.md specifications
export function formatCutlineError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("EmptyName")) {
    return "Name cannot be empty.";
  }
  if (msg.includes("NameTooLong")) {
    return "Name is too long (maximum 48 bytes).";
  }
  if (msg.includes("ZeroStep")) {
    return "Step price must be greater than zero.";
  }
  if (msg.includes("LineNotFound")) {
    return "Line not found.";
  }
  if (msg.includes("LineClosed")) {
    return "This line is closed to new joins.";
  }
  if (msg.includes("HostCannotJoin")) {
    return "You run this line; use Serve next.";
  }
  const alreadyMatch = msg.match(/AlreadyInLine\((\d+)\)/);
  if (alreadyMatch || msg.includes("AlreadyInLine")) {
    const pos = alreadyMatch ? alreadyMatch[1] : "your current position";
    return `You are already in this line, at place ${pos}.`;
  }
  if (msg.includes("QueueFull")) {
    return "Queue is full (maximum 500 live entries).";
  }
  const paymentMatch = msg.match(/WrongPayment\((\d+)\)/);
  if (paymentMatch || msg.includes("WrongPayment")) {
    return "The line moved. Quote again before submitting.";
  }
  if (msg.includes("NotInLine")) {
    return "You are not currently in this line.";
  }
  if (msg.includes("BadSteps")) {
    return "You can skip between 1 and 10 steps.";
  }
  const farMatch = msg.match(/NotThatFar\((\d+)\)/);
  if (farMatch || msg.includes("NotThatFar")) {
    const n = farMatch ? farMatch[1] : "0";
    return `You can only pass ${n} people from where you are.`;
  }
  if (msg.includes("NotHost")) {
    return "Only the line host can perform this action.";
  }
  if (msg.includes("EmptyLine")) {
    return "No one is waiting in line.";
  }
  if (msg.includes("NothingToWithdraw")) {
    return "No pending funds available to withdraw.";
  }
  if (msg.includes("TransferFailed")) {
    return "Transfer failed.";
  }
  if (msg.includes("User rejected") || msg.includes("User denied")) {
    return "Transaction was rejected in wallet.";
  }

  return msg.length > 120 ? `${msg.slice(0, 117)}...` : msg;
}
