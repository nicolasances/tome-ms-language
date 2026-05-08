import { getHyperscalerConfiguration, SupportedHyperscalers, TotoMicroservice, TotoMicroserviceConfiguration } from 'totoms';
import { ControllerConfig } from "./Config";
import { CompleteSession } from './dlg/session/CompleteSession';
import { DeleteWord } from './dlg/DeleteWord';
import { GetActiveSession } from './dlg/session/GetActiveSession';
import { GetRollingSessionStats } from './dlg/session/GetRollingSessionStats';
import { GetSentences } from './dlg/GetSentences';
import { GetVocabulary } from './dlg/GetVocabulary';
import { GetWeeklySessionStats } from './dlg/session/GetWeeklySessionStats';
import { PostSentence } from './dlg/PostSentence';
import { PostSentences } from './dlg/PostSentences';
import { PostWord } from './dlg/PostWord';
import { PostWords } from './dlg/PostWords';
import { PutWord } from './dlg/PutWord';
import { SampleWords } from './dlg/SampleWords';
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
            { method: 'GET', path: '/vocabulary/:language', delegate: GetVocabulary },
            { method: 'POST', path: '/vocabulary/:language/words', delegate: PostWord },
            { method: 'POST', path: '/vocabulary/:language/words/batch', delegate: PostWords },
            { method: 'GET', path: '/vocabulary/:language/words/sample', delegate: SampleWords },
            { method: 'PUT', path: '/vocabulary/:language/words/:id', delegate: PutWord },
            { method: 'DELETE', path: '/vocabulary/:language/words/:id', delegate: DeleteWord },
            { method: 'GET', path: '/sentences/:language', delegate: GetSentences },
            { method: 'POST', path: '/sentences/:language', delegate: PostSentence },
            { method: 'POST', path: '/sentences/:language/batch', delegate: PostSentences },
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
