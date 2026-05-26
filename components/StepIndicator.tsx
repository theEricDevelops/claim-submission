interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
  onStepClick?: (step: number) => void;
}

export default function StepIndicator({
  currentStep,
  totalSteps,
  labels,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div className="step-indicator">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`step-item${i === currentStep ? " active" : ""}${i < currentStep ? " completed" : ""}${onStepClick && i < currentStep ? " clickable" : ""}`}
          onClick={onStepClick && i < currentStep ? () => onStepClick(i) : undefined}
          role={onStepClick && i < currentStep ? "button" : undefined}
          tabIndex={onStepClick && i < currentStep ? 0 : undefined}
          onKeyDown={onStepClick && i < currentStep ? (e) => { if (e.key === "Enter" || e.key === " ") onStepClick(i); } : undefined}
        >
          <div className="step-circle">
            {i < currentStep ? (
              <span>&#10003;</span>
            ) : (
              <span>{i + 1}</span>
            )}
          </div>
          <div className="step-label">{labels[i]}</div>
        </div>
      ))}
    </div>
  );
}
