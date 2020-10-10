import {Injectable} from '@angular/core';

import {RxStomp, RxStompConfig, RxStompState} from '@stomp/rx-stomp';

import {publishParams, Client, Message, Frame} from '@stomp/stompjs';

import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {map} from 'rxjs/operators';

import {StompState} from './stomp-state';
import { StompHeaders } from './stomp-headers';
import {StompConfig} from './stomp.config';

/**
 * Part of `@stomp/ng2-stompjs`.
 *
 * **This class has been deprecated in favor of {@link RxStompService}.
 * It will be dropped `@stomp/ng2-stompjs@8.x.x`.**
 *
 * Angular2 STOMP Raw Service using @stomp/stomp.js
 *
 * You will only need the public properties and
 * methods listed unless you are an advanced user. This service handles subscribing to a
 * message queue using the stomp.js library, and returns
 * values via the ES6 Observable specification for
 * asynchronous value streaming by wiring the STOMP
 * messages into an observable.
 *
 * If you will like to pass the configuration as a dependency,
 * please use StompService class.
 */
@Injectable()
export class StompRService extends RxStomp {
  /**
   * State of the STOMPService
   *
   * It is a BehaviorSubject and will emit current status immediately. This will typically get
   * used to show current status to the end user.
   */
  public state: BehaviorSubject<StompState>;

  private static _mapStompState(st: RxStompState): StompState {
    if (st === RxStompState.CONNECTING) {
      return StompState.TRYING;
    }
    if (st === RxStompState.OPEN) {
      return StompState.CONNECTED;
    }
    if (st === RxStompState.CLOSING) {
      return StompState.DISCONNECTING;
    }
    if (st === RxStompState.CLOSED) {
      return StompState.CLOSED;
    }
  }

  /**
   * Will trigger when connection is established. Use this to carry out initialization.
   * It will trigger every time a (re)connection occurs. If it is already connected
   * it will trigger immediately. You can safely ignore the value, as it will always be
   * StompState.CONNECTED
   */
  get connectObservable(): Observable<StompState> {
    return this.connected$.pipe(map((st: RxStompState): StompState => {
      return StompRService._mapStompState(st);
    }));
  }

  /**
   * Provides headers from most recent connection to the server as return by the CONNECTED
   * frame.
   * If the STOMP connection has already been established it will trigger immediately.
   * It will additionally trigger in event of reconnection, the value will be set of headers from
   * the recent server response.
   */
  get serverHeadersObservable(): Observable<StompHeaders> {
    return this.serverHeaders$;
  }

  /**
   * Will emit all messages to the default queue (any message that are not handled by a subscription)
   */
  get defaultMessagesObservable(): Subject<Message> {
    return this.unhandledMessage$;
  }

  /**
   * Will emit all receipts
   */
  get receiptsObservable(): Subject<Frame> {
    return this.unhandledReceipts$;
  }

  /**
   * Will trigger when an error occurs. This Subject can be used to handle errors from
   * the stomp broker.
   */
  get errorSubject(): Subject<string | Frame> {
    return this.stompErrors$;
  }

  /** Set configuration */
  set config(config: StompConfig) {
    const rxStompConfig: RxStompConfig = { };

    if (typeof(config.url) === 'string') {
      rxStompConfig.brokerURL = config.url;
    } else {
      rxStompConfig.webSocketFactory = config.url;
    }

    // Configure client heart-beating
    rxStompConfig.heartbeatIncoming = config.heartbeat_in;
    rxStompConfig.heartbeatOutgoing = config.heartbeat_out;

    // Auto reconnect
    rxStompConfig.reconnectDelay = config.reconnect_delay;

    if (config.debug) {
      rxStompConfig.debug = (str: string): void => {
        console.log(new Date(), str);
      };
    }

    rxStompConfig.connectHeaders = config.headers;

    this.configure(rxStompConfig);
  }
  /**
   * It will connect to the STOMP broker.
   */
  public initAndConnect(): void {
    // disconnect if connected
    this.deactivate();

    // Attempt connection, passing in a callback
    this.activate();
  }

  /**
   * It will disconnect from the STOMP broker.
   */
  public disconnect(): void {
    this.deactivate();
  }

  /**
   * It will send a message to a named destination. The message must be `string`.
   *
   * The message will get locally queued if the STOMP broker is not connected. It will attempt to
   * publish queued messages as soon as the broker gets connected.
   *
   * @param queueName
   * @param message
   * @param headers
   */
  public publish(queueName: string|publishParams, message?: string, headers: StompHeaders = {}): void {
    if (typeof queueName === 'string') {
      super.publish({destination: queueName as string, body: message, headers});
    } else {
      const pubParams: publishParams = queueName;
      super.publish(pubParams);
    }
  }

  /**
   * It will subscribe to server message queues
   *
   * This method can be safely called even if the STOMP broker is not connected.
   * If the underlying STOMP connection drops and reconnects, it will resubscribe automatically.
   *
   * If a header field 'ack' is not explicitly passed, 'ack' will be set to 'auto'. If you
   * do not understand what it means, please leave it as is.
   *
   * Note that when working with temporary queues where the subscription request
   * creates the
   * underlying queue, messages might be missed during reconnect. This issue is not specific
   * to this library but the way STOMP brokers are designed to work.
   *
   * @param queueName
   * @param headers
   */
  public subscribe(queueName: string, headers: StompHeaders = {}): Observable<Message> {
    return this.watch(queueName, headers);
  }

  /**
   * STOMP brokers may carry out operation asynchronously and allow requesting for acknowledgement.
   * To request an acknowledgement, a `receipt` header needs to be sent with the actual request.
   * The value (say receipt-id) for this header needs to be unique for each use. Typically a sequence, a UUID, a
   * random number or a combination may be used.
   *
   * A complaint broker will send a RECEIPT frame when an operation has actually been completed.
   * The operation needs to be matched based in the value of the receipt-id.
   *
   * This method allow watching for a receipt and invoke the callback
   * when corresponding receipt has been received.
   *
   * The actual {@link Frame}
   * will be passed as parameter to the callback.
   *
   * Example:
   * ```javascript
   *        // Publishing with acknowledgement
   *        let receiptId = randomText();
   *
   *        rxStomp.waitForReceipt(receiptId, function() {
   *          // Will be called after server acknowledges
   *        });
   *        rxStomp.publish({destination: TEST.destination, headers: {receipt: receiptId}, body: msg});
   * ```
   *
   * Maps to: [Client#watchForReceipt]{@link Client#watchForReceipt}
   */
  public waitForReceipt(receiptId: string, callback: (frame: Frame) => void): void {
    super.watchForReceipt(receiptId, callback);
  }

  get client(): Client {
    return this._stompClient;
  }

  public constructor() {
    super();

    this.state = new BehaviorSubject<StompState>(StompState.CLOSED);

    this.connectionState$.subscribe((st: RxStompState) => {
      this.state.next(StompRService._mapStompState(st));
    });
  }
}
