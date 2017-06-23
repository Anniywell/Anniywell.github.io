---
title: Python协程
date: 2017-06-23 14:08:15
tags: [Python, 协程]
categories: Python
---

## 协程简介

协程，即协作式程序，又称微线程、纤程，英文名Coroutine。

其思想是，一系列互相依赖的协程间依次使用CPU，每次只有一个协程工作，而其他协程处于休眠状态。协程可以在运行期间的某个点上暂停执行，并在恢复运行时从暂停的点上继续执行。
协程已经被证明是一种非常有用的程序组件，不仅被python、lua、ruby等脚本语言广泛采用，而且被新一代面向多核的编程语言如golang rust-lang等采用作为并发的基本单位。
协程可以被认为是一种用户空间线程，与传统的线程相比，有2个主要的优点：

- 与线程不同，协程是自己主动让出CPU，并交付他期望的下一个协程运行，而不是在任何时候都有可能被系统调度打断。因此协程的使用更加清晰易懂，并且多数情况下不需要锁机制。
- 与线程相比，协程的切换由程序控制，发生在用户空间而非内核空间，因此切换的代价非常小。

总结起来是一句话：协程可以认为是一种用户态线程，与系统提供的线程不同点是，它需要主动让出CPU时间，而不是由系统进行调度，即控制权在程序员手上。

## Python协程史
* Python 2.2 中的生成器让代码执行过程可以暂停 (yield)
* Python 2.5 中可以将值返回给暂停的生成器，这使得 Python 中协程的概念成为可能 (send)
* Python 3.3 中的 yield from，使得重构生成器与将它们串联起来都很简单 (yield from)
* Python 3.4 以后通过标准库 asyncio 获得了事件循环的特性 (asyncio)
* Python 3.5 使用async/await语法引入对协程的显式支持 (async/await)
* Python 3.6 增强asyncio，支持异步生成器、异步解析式

<!-- more -->

## yield

为了理解什么是 yield, 你必须理解什么是生成器(generator)。

关于生成器我的理解是是：生成器保存的是算法，需要时再计算(惰性计算)

创建生成器有两种方式：

第一种方法：把一个列表生成式的[]改成()，就创建了一个generator：

```python
l = [x * x for x in range(10)]    # l [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
g = (x * x for x in range(10))    # g <generator object <genexpr> at 0x1022ef630>
```

第二种方式：在函数中使用yield关键字，函数就变成了一个generator。

函数里有了yield后，执行到yield就会停住，当需要再往下算时才会再往下算。所以生成器函数即使是有无限循环也没关系，它需要算到多少就会算多少，不需要就不往下算。

例如你想要自己实现一个 range() 函数，你可以用立即计算的方式创建一个整数列表：

```python
def eager_range(up_to):
    """Create a list of integers, from 0 to up_to, exclusive."""
    sequence = []
    index = 0
    while index < up_to:
        sequence.append(index)
        index += 1
    return sequence

l = eager_range(1000000)
```

然而这里存在的问题是，如果你想创建从0到1,000,000这样一个很大的序列，你不得不创建能容纳1,000,000个整数的列表。
但是当加入了生成器之后，你可以不用创建完整的序列，你只需要能够每次保存一个整数的内存即可。

```python
def lazy_range(up_to):
    """Generator to return the sequence of integers from 0 to up_to, exclusive."""
    index = 0
    while index < up_to:
        yield index
        index += 1

g = lazy_range(1000000)    # <generator object lazy_range at 0x040A25D0>
next(g)
...
...
...
next(g)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
StopIteration
```

让函数遇到 yield 表达式时暂停执行 – 虽然在 Python 2.5 以前它只是一条语句 – 并且能够在后面重新执行，这对于减少内存使用、生成无限序列非常有用。

你有可能已经发现，生成器完全就是关于迭代器的。有一种更好的方式生成迭代器当然很好（尤其是当你可以给一个生成器对象添加 __iter__() 方法时），
但是人们知道，如果可以利用生成器“暂停”的部分，添加“将东西发送回生成器”的功能，那么 Python 突然就有了协程的概念（当然这里的协程仅限于 Python 中的概念；Python 中真实的协程在后面才会讨论）。
将东西发送回暂停了的生成器这一特性通过 PEP 342添加到了 Python 2.5。
与其它特性一起，PEP 342 为生成器引入了 send() 方法。这让我们不仅可以暂停生成器，而且能够传递值到生成器暂停的地方。
还是以我们的 range() 为例，你可以让序列向前或向后跳过几个值：

```python
def jumping_range(up_to):
    """Generator for the sequence of integers from 0 to up_to, exclusive.
    Sending a value into the generator will shift the sequence by that amount.
    """
    index = 0
    while index < up_to:
        jump = yield index
        if jump is None:
            jump = 1
        index += jump

iterator = jumping_range(5)
print(next(iterator))     # 0
print(iterator.send(2))   # 2
print(next(iterator))     # 3
print(iterator.send(-1))  # 2
for x in iterator:
    print(x)              # 3, 4
```

其实next()和send()在一定意义上作用是相似的，区别是send()可以传递yield表达式的值进去，而next()不能传递特定的值，只能传递None进去。

因此，我们可以看做next(g) == g.send(None)

需要注意的是，第一次调用时，请使用next()语句或是send(None)，不能使用send发送一个非None的值，否则会出错，因为没有yield语句来接收这个值。

## yield from

在PEP 380 为 Python 3.3 添加了 yield from之前，生成器都没有变动。
严格来说，这一特性让你能够从迭代器（生成器刚好也是迭代器）中返回任何值，从而可以干净利索的方式重构生成器。

```python
yield from iterator
# (本质上)相当于：
for x in iterator:
    yield x
```

```python
def lazy_range(up_to):
    """Generator to return the sequence of integers from 0 to up_to, exclusive."""
    index = 0
    def gratuitous_refactor():
        while index < up_to:
            yield index
            index += 1
    yield from gratuitous_refactor()
```

yield from 通过让重构变得简单，也让你能够将生成器串联起来，使返回值可以在调用栈中上下浮动，而不需对编码进行过多改动。

```python
def bottom():
    """Returning the yield lets the value that goes up the call stack to come right back down"""
    return (yield 42)

def middle():
    return (yield from bottom())

def top():
    return (yield from middle())

# Get the generator.
gen = top()
value = next(gen)
print(value)  # Prints '42'.
try:
    value = gen.send(value * 2)
except StopIteration as exc:
    value = exc.value
print(value)  # Prints '84'.
```

## asyncio

asyncio是一个基于事件循环的异步I/O库，Python3.4将其引入标准库，Python3.3可通过pip安装

asyncio包括的内容很多很复杂，这里只会做基本的两点：协同程序和事件循环。

协程的基本概念前面已经讲过，这里先来说一下事件循环

通俗来说，事件循环 “是一种等待程序分配事件或消息的编程架构”，其提供一种循环机制，让你可以“在A发生时，执行B”。基本上来说事件循环就是监听当有什么发生时，同时事件循环也关心这件事并执行相应的代码，本质上是以队列的方式来重新分配时间片。

在asyncio中事件循环扮演的是个调度器的角色，被用来安排协同程序的执行。

PEP 342中通过asyncio.coroutine装饰的函数为协程，这里的协程是和asyncio及其事件循环一起使用的。

这赋予了 Python 第一个对于协程的明确定义，也就是基于生成器的协程

这意味着突然之间所有实现了协程接口的生成器，即便它们并不是要以协程方式应用，都符合这一定义。为了修正这一点，asyncio 要求所有要用作协程的生成器必须由asyncio.coroutine修饰。

使用以下语法声明生成器协程：

```python
@asyncio.coroutine
def generator_coroutine():
    pass

a = generator_coroutine()
print(a)    # <generator object coro at 0x040F0B48>
```

yield from在asyncio模块中得以发扬光大。通过yield from，我们可以用asyncio.sleep将协程控制权交给事件循环，然后挂起当前协程；之后，由事件循环决定何时唤醒asyncio.sleep,接着向后执行代码。
先看示例代码：

```python
import asyncio

@asyncio.coroutine
def countdown(number, n):
    while n > 0:
        print('T-minus', n, '({})'.format(number))
        yield from asyncio.sleep(1)
        n -= 1

loop = asyncio.get_event_loop()
tasks = [
    asyncio.ensure_future(countdown("A", 2)),
    asyncio.ensure_future(countdown("B", 3))]
loop.run_until_complete(asyncio.wait(tasks))
loop.close()
```

在解释上面例子之前，需要先简单了解一下asyncio.Future

Future可以理解为延迟结果的抽象，在其他语言中也称作Promise.
你可以对任何asyncio.Future对象使用 yield from，从而将其传递给事件循环，暂停协程的执行来等待某些事情的发生（ future 对象并不重要，只是asyncio细节的实现）。
一旦 future 对象获取了事件循环，它会一直在那里监听，直到完成它需要做的一切。
当 future 完成自己的任务之后，事件循环会察觉到，暂停并等待在那里的协程会通过send()方法获取future对象的返回值并开始继续执行。

以上面的代码为例, 事件循环启动每一个 countdown() 协程，一直执行到遇见其中一个协程的 yield from 和 asyncio.sleep() 。这样会返回一个 asyncio.Future对象并将其传递给事件循环，同时暂停这一协程的执行。事件循环会监控这一future对象，直到倒计时1秒钟之后（同时也会检查其它正在监控的对象，比如像其它协程）。1秒钟的时间一到，事件循环会选择刚刚传递了future对象并暂停了的 countdown() 协程，将future对象的结果返回给协程，然后协程可以继续执行。这一过程会一直持续到所有的 countdown() 协程执行完毕，事件循环也被清空。稍后我会给你展示一个完整的例子，用来说明协程/事件循环之类的这些东西究竟是如何运作的，但是首先我想要解释一下async和await。

关于asyncio这里只做了简单的介绍，它其实包括以下内容，大家可以去查看[官方文档](https://docs.python.org/3/library/asyncio.html?highlight=asyncio#module-asyncio)：

- 事件循环
- 任务和协程
- 传输和协议
- 基于协程的流
- 子进程
- 同步原语
- 队列

## async与await

PEP 492引入async/await语法，中明确了协程类型(原生协程)，用于区别于基于生成器的协程

在以前，我们可以用生成器实现协程（PEP 342），后来又对其进行了改进，引入了yield from语法（PEP 380）。但仍有一些缺点：

1. 协程和普通生成器使用相同的语法，所以很容易把它们搞混，初学者更是如此。
2. 一个函数是否是一个协程，取决于它里面是否出现了yield或yield from语句。这并不明显，容易在重构函数的时候搞乱，导致出错。
3. 异步调用被yield语法限制了，我们不能获得、使用更多的语法特性，比如with和for。

这个PEP把协程从生成器独立出来，成为Python的一个原生事物。这会消除协程和生成器之间的混淆，方便编写不依赖特定库的协程代码。

使用以下语法声明原生协程：

```python
async def native_coroutine():
    pass

a = native_coroutine()
print(a)    # <coroutine object a at 0x000000000567EFC0>
```

原生协程语法的关键点：

- async def函数必定是协程，即使里面不含有await语句。
- 如果在async函数里面使用yield或yield from语句，会引发SyntaxError异常。
- 协程在调用时会返回一个coroutine对象
- 协程不再抛出StopIteration异常，而是替代为RuntimeError
- 当协程进行垃圾回收时，一个从未被await的协程会抛出RuntimeWarning异常

**await**表达式

下面新的await表达式用于获取协程执行结果：

```python
async def read_data(db):
    data = await db.fetch('SELECT ...')
    pass
```

await与yield from相似，挂起read_data协程的执行直到db.fetch这个awaitable对象完成并返回结果数据。

原生协程与生成器协程的区别与联系

- 原生协程对象不实现__iter__和__next__方法。因此，他们不能够通过iter()，list()，tuple()和其他一些内置函数进行迭代。他们也不能用于for...in循环。在原生协程中尝试使用__iter__或者__next会触发TypeError异常。
- 未被装饰的生成器不能够yield from一个原生协程：这样会引发TypeError。
- 基于生成器的协程(asyncio代码必须使用@asyncio.coroutine)可以yield from一个原生协程。
- 对原生协程对象和原生协程函数调用inspect.isgenerator()和inspect.isgeneratorfunction()会返回False。
- 协程内部基于生成器，原生协程与生成器协程共享实现过程。类似于生成器对象，原生协程包含throw()，send()和close()方法。

## 异步生成器与异步解析式

PEP 492 引入支持原生协程和async /await的语法到Python 3.5。 在Python 3.5实现里的一个值得注意的局限性就在于它不可能使用await和yield在同一个函数体中。 
而在Python 3.6中，这个限制已解除，这使得定义异步生成器成为可能：

```python
async def ticker(delay, to):
    """Yield numbers from 0 to *to* every *delay* seconds."""
    for i in range(to):
        yield i
        await asyncio.sleep(delay)
```

PEP 530 添加了对async for在list、set、dict解析式以及generator表达式中的使用支持：

    result = [i async for i in aiter() if i % 2]

此外，所有解析式都支持“await”表达式：

    result = [await fun() for fun in funcs if await condition()]

## gevent

gevent是一个基于协同的Python网络库，它使用greenlet在libev事件循环之上提供高级同步API。

主要特性：
- 基于libev的快速事件循环
- 基于greenlet的轻量级执行单元
- 重用python标准api(event,queue)
- 协同的socket和ssl模块
- 使用标准库和第三方模块写标准阻塞socket(gevent.monkey)
- 通过线程池或c-ares执行的DNS查询。
- 内置TCP/UDP/HTTP服务器
- 支持子进程(gevent.subprocess)
- 支持线程池

下面简单介绍gevent的使用

![gevent-flow](http://xlambda.com/gevent-tutorial/flow.gif)

gevent.spawn(function, *args, **kwargs)  
创建一个新的Greenlet对象并安排它运行function(*args，**kwargs)

注意：这时function还没有启动，它的运行依赖于gevent的事件循环，只有启动事件循环，它才会被调度

gevent.sleep(seconds=0)

将当前的greenlet睡眠seconds秒

使用gevent.sleep相当于切换上下文，让出执行权

gevent.joinall

等待多个greenlet执行结束

有时需要知道greenlet运行的状态，在greenlet中有一些标志， 让你可以监视它的线程内部状态:
- started -- Boolean, 指示此Greenlet是否已经启动
- ready() -- Boolean, 指示此Greenlet是否已经停止
- successful() -- Boolean, 指示此Greenlet是否已经停止而且没抛异常
- value -- 任意值, 此Greenlet代码返回的值
- exception -- 异常, 此Greenlet内抛出的未捕获异常

更多[gevent api](http://www.gevent.org/gevent.html#module-gevent)介绍

## 参考文档

* [Python官方文档](https://docs.python.org/3/library/asyncio.html)
* [PEP 255 -- Simple Generators](https://www.python.org/dev/peps/pep-0255/)
* [PEP 342 -- Coroutines via Enhanced Generators](https://www.python.org/dev/peps/pep-0342/)
* [PEP 380 -- Syntax for Delegating to a Subgenerator](https://www.python.org/dev/peps/pep-0380/)
* [PEP 3156 -- Asynchronous IO Support Rebooted: the "asyncio" Module](https://www.python.org/dev/peps/pep-3156/)
* [PEP 492 -- Coroutines with async and await syntax](https://www.python.org/dev/peps/pep-0492/)
* [廖雪峰Python教程](http://www.liaoxuefeng.com/wiki/0014316089557264a6b348958f449949df42a6d3a2e542c000)
* [PEP 525](https://www.python.org/dev/peps/pep-0525/)
* [PEP 530](https://www.python.org/dev/peps/pep-0530/)
* [Python 3.5协程原理](https://github.com/SimonXming/my-blog/issues/23)
* [gevent官方文档](http://www.gevent.org/contents.html)
* [gevent教程](http://sdiehl.github.io/gevent-tutorial/)