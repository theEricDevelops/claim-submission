interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export default function StepIndicator({
  currentStep,
  totalSteps,
  labels,
}: StepIndicatorProps) {
  return (
    <div className="step-indicator">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`step-item${i === currentStep ? " active" : ""}${i < currentStep ? " completed" : ""}`}
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
