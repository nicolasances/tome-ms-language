import { getHyperscalerConfiguration, SupportedHyperscalers, TotoMicroservice, TotoMicroserviceConfiguration } from 'totoms';
import { ControllerConfig } from "./Config";
import { AddSentenceAlternative } from './dlg/AddSentenceAlternative';
import { CompleteSession } from './dlg/session/CompleteSession';
import { GetActiveSession } from './dlg/session/GetActiveSession';
import { GetRollingSessionStats } from './dlg/session/GetRollingSessionStats';
import { GetSentence } from './dlg/GetSentence';
import { GetSentences } from './dlg/GetSentences';
import { GetSentencesWithStats } from './dlg/GetSentencesWithStats';
import { GetVocabularyItem } from './dlg/GetVocabularyItem';
import { GetVocabularyItems } from './dlg/GetVocabularyItems';
import { GetWeeklySessionStats } from './dlg/session/GetWeeklySessionStats';
import { LookupVocabularyItems } from './dlg/LookupVocabularyItems';
import { PostSentence } from './dlg/PostSentence';
import { PostSentences } from './dlg/PostSentences';
import { PostVocabularyItem } from './dlg/PostVocabularyItem';
import { PostVocabularyItemBatch } from './dlg/PostVocabularyItemBatch';
import { RemoveSentenceAlternative } from './dlg/RemoveSentenceAlternative';
import { StartSession } from './dlg/session/StartSession';
import { SubmitAnswer } from './dlg/session/SubmitAnswer';

const config: TotoMicroserviceConfiguration = {
    serviceName: "tome-ms-language",
    basePath: '/tomelang',
    environment: {
        hyperscaler: process.env.HYPERSCALER as SupportedHyperscalers || "aws",
        hyperscalerConfiguration: getHyperscalerConfiguration()
    },
    customConfiguration: ControllerConfig,
    apiConfiguration: {
        apiEndpoints: [
            { method: 'POST', path: '/vocabularyItems', delegate: PostVocabularyItem },
            { method: 'POST', path: '/vocabularyItems/batch', delegate: PostVocabularyItemBatch },
            { method: 'POST', path: '/vocabularyItems/lookup', delegate: LookupVocabularyItems },
            { method: 'GET', path: '/vocabularyItems', delegate: GetVocabularyItems },
            { method: 'GET', path: '/vocabularyItems/:id', delegate: GetVocabularyItem },
            { method: 'GET', path: '/sentences/:language', delegate: GetSentences },
            { method: 'GET', path: '/sentences/:language/with-stats', delegate: GetSentencesWithStats },
            { method: 'POST', path: '/sentences/:language', delegate: PostSentence },
            { method: 'POST', path: '/sentences/:language/batch', delegate: PostSentences },
            { method: 'GET', path: '/sentences/:language/:sentenceId', delegate: GetSentence },
            { method: 'POST', path: '/sentences/:language/:sentenceId/alternatives', delegate: AddSentenceAlternative },
            { method: 'DELETE', path: '/sentences/:language/:sentenceId/alternatives/:id', delegate: RemoveSentenceAlternative },
            { method: 'POST', path: '/languages/:language/sessions', delegate: StartSession },
            { method: 'GET', path: '/sessions/active', delegate: GetActiveSession },
            { method: 'GET', path: '/sessions/stats/weekly', delegate: GetWeeklySessionStats },
            { method: 'GET', path: '/sessions/stats/rolling', delegate: GetRollingSessionStats },
            { method: 'POST', path: '/sessions/:sessionId/answers', delegate: SubmitAnswer },
            { method: 'POST', path: '/sessions/:sessionId/completion', delegate: CompleteSession },
        ],
        apiOptions: { noCorrelationId: true }
    },
};

TotoMicroservice.init(config).then(microservice => {
    microservice.start();
});
