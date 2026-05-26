interface StepIndicatorProps {
  currentStep: number
  totalSteps: number
  labels: string[]
  maxCompletedStep: number
  onStepClick?: (step: number) => void
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
      {totalSteps > 0 &&
        Array.from({ length: totalSteps }).map((_, i) => {
          const completed = i < maxCompletedStep
          const reached = i <= maxCompletedStep
          const active = i === currentStep
          const clickable = reached && !active && !!onStepClick
          return (
            <button
              key={labels[i]}
              type="button"
              className={`step-item${active ? ' active' : ''}${completed ? ' completed' : ''}${reached ? ' reached' : ''}${clickable ? ' clickable' : ''}`}
              onClick={() => clickable && onStepClick?.(i)}
              tabIndex={reached ? 0 : -1}
            >
              <div className="step-circle">
                {completed ? <span>&#10003;</span> : <span>{i + 1}</span>}
              </div>
              <div className="step-label">{labels[i]}</div>
            </button>
          )
        })}
    </div>
  )
}
