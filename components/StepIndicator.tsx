interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
  maxCompletedStep: number;
  onStepClick?: (step: number) => void;
}

export default function StepIndicator({
  currentStep,
  totalSteps,
  labels,
  maxCompletedStep,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div className="step-indicator">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const completed = i < maxCompletedStep;
        const reached = i <= maxCompletedStep;
        const active = i === currentStep;
        const clickable = reached && !active && !!onStepClick;
        return (
          <div
            key={i}
            className={`step-item${active ? " active" : ""}${completed ? " completed" : ""}${reached ? " reached" : ""}${clickable ? " clickable" : ""}`}
            onClick={clickable ? () => onStepClick(i) : undefined}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") onStepClick(i); } : undefined}
          >
            <div className="step-circle">
              {completed ? (
                <span>&#10003;</span>
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
            <div className="step-label">{labels[i]}</div>
          </div>
        );
      })}
    </div>
  );
}
