
import React, { useState } from 'react';
import type { SampleScenario } from '../types';
import type { Translations } from '../i18n';
import ChevronDownIcon from './icons/ChevronDownIcon';
import { sampleScenarios } from '../data/sample-scenarios';

interface UserGuideProps {
  onLoadScenario: (scenarioData: SampleScenario['data']) => void;
  translations: Translations;
}

const useCaseIds = ['01', '02', '03', '04', '05', '06', '07', '08', '09'];

const AccordionItem = ({ title, goal, features, isOpen, onToggle, translations }: { title: string, goal: string, features: string, isOpen: boolean, onToggle: () => void, translations: Translations }) => {
    return (
        <div className="border-b border-theme-subtle">
            <button
                onClick={onToggle}
                className="w-full flex justify-between items-center text-left py-3 px-2"
                aria-expanded={isOpen}
            >
                <span className="font-semibold text-theme-primary">{title}</span>
                <ChevronDownIcon className={`w-5 h-5 text-theme-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="px-2 pb-4 text-sm text-theme-secondary">
                    <p><strong className="text-theme-primary">{translations.useCases.goal}:</strong> {goal}</p>
                    <p className="mt-2"><strong className="text-theme-primary">{translations.useCases.features}:</strong> {features}</p>
                </div>
            )}
        </div>
    );
}

function UserGuide({ onLoadScenario, translations }: UserGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const toggleAccordion = (id: string) => {
    setOpenAccordion(openAccordion === id ? null : id);
  };
  
  return (
    <div className="bg-theme-surface rounded-lg shadow-md border border-theme-subtle">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex justify-between items-center text-left p-4 sm:p-6"
        aria-expanded={isOpen}
      >
        <span className="text-lg font-semibold text-theme-primary">{translations.userGuideTitle}</span>
        <ChevronDownIcon className={`w-5 h-5 text-theme-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-4 sm:px-6 pb-6 border-t border-theme-subtle space-y-8">
          
          <section className="pt-4">
            <h3 className="text-xl font-bold text-theme-primary mb-2">{translations.useCases.title}</h3>
            <div className="border-t border-theme-subtle">
              {useCaseIds.map(id => {
                  const titleKey = `uc${id}Title` as keyof Translations['useCases'];
                  const goalKey = `uc${id}Goal` as keyof Translations['useCases'];
                  const featuresKey = `uc${id}Features` as keyof Translations['useCases'];
                  
                  return (
                      <AccordionItem
                          key={id}
                          title={translations.useCases[titleKey]}
                          goal={translations.useCases[goalKey]}
                          features={translations.useCases[featuresKey]}
                          isOpen={openAccordion === id}
                          onToggle={() => toggleAccordion(id)}
                          translations={translations}
                      />
                  )
              })}
            </div>
          </section>

          <section className="pt-4 border-t border-theme-strong">
            <h3 className="text-xl font-bold text-theme-primary mb-4">{translations.sampleScenarios}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sampleScenarios.map(scenario => (
                    <div key={scenario.id} className="bg-theme-subtle p-4 rounded-lg border border-theme-subtle flex flex-col justify-between">
                        <div>
                            <h4 className="font-bold text-theme-interactive">{translations[scenario.titleKey as keyof Translations] as string}</h4>
                            <p className="text-sm text-theme-secondary mt-1 mb-3 min-h-[5rem]">{translations[scenario.descriptionKey as keyof Translations] as string}</p>
                        </div>
                        <button
                            onClick={() => onLoadScenario(scenario.data)}
                            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-theme-on-interactive bg-theme-interactive rounded-md shadow-sm hover:bg-theme-interactive-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-interactive"
                        >
                            {translations.loadScenario}
                        </button>
                    </div>
                ))}
            </div>
          </section>

        </div>
      )}
    </div>
  );
}

export default UserGuide;