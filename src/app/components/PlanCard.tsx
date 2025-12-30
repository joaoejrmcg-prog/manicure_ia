interface PlanCardProps {
    name: string;
    price: string;
    features: string[];
    isCurrentPlan: boolean;
    isMostPopular?: boolean;
    onSelect: () => void;
}

export default function PlanCard({ name, price, features, isCurrentPlan, isMostPopular, onSelect }: PlanCardProps) {
    const colors = {
        'LIGHT': 'from-green-500 to-emerald-500',
        'PRO': 'from-blue-500 to-indigo-500',
    };

    const gradient = colors[name as keyof typeof colors] || 'from-gray-500 to-gray-600';

    return (
        <div className={`relative bg-white rounded-2xl shadow-sm border-2 transition-all duration-300 hover:shadow-lg ${isCurrentPlan ? 'border-blue-500 scale-105' : 'border-gray-200'
            }`}>
            {/* Badge */}
            {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
                    SEU PLANO ATUAL
                </div>
            )}
            {isMostPopular && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-full">
                    MAIS POPULAR
                </div>
            )}

            <div className="p-6">
                {/* Header */}
                <div className={`inline-block px-4 py-2 rounded-lg bg-gradient-to-r ${gradient} text-white font-bold text-lg mb-4`}>
                    {name}
                </div>

                {/* Price */}
                <div className="mb-6">
                    <div className="text-3xl font-bold text-gray-800">{price}</div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                    {features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-gray-700">
                            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-sm">{feature}</span>
                        </li>
                    ))}
                </ul>

                {/* Button */}
                <button
                    onClick={onSelect}
                    disabled={isCurrentPlan}
                    className={`w-full py-3 rounded-xl font-medium transition-all duration-200 ${isCurrentPlan
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : `bg-gradient-to-r ${gradient} text-white hover:opacity-90 active:scale-95`
                        }`}
                >
                    {isCurrentPlan ? 'Plano Atual' : 'Assinar'}
                </button>
            </div>
        </div>
    );
}
