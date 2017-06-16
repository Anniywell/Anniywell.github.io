---
title: 浅析Python元类及应用
date: 2017-06-16 15:28:36
tags: [Python, 元编程]
categories: Python
---
## 写这篇文章的缘由
前几天去一家公司面试，面试的岗位是Python后台开发，面试中被问到了一道题，考虑很久想不到答案，顾回来查阅资料在此总结一下。
题目的描述是这样的：
```
SQLAlchemy中Model中定义类成员时，如何做到声明顺序与数据库表的列顺序一致
提示：普通类成员是存储在__dict__，而dict本身是无序的
```
通过阅读SQLAlchemy源码得知，其内部实现是使用元类编程来完成的，元类编程是Python的一种高级黑暗魔法，经常听其大名，并没有进入深入了解，借此机会稍微总结一下。

## 元编程
元编程我个人理解是：**用代码生成（操纵）代码**的编程手法。
Python中元编程的几种手段：
- 预定义方法
- 函数赋值
- descriptor
- eval
- 元类

上面的几种方式相对于元类来说简单一些，这里暂时先不讲了，以后有时间再去补充

## 元类
### 类也是对象
在Python中一切皆对象，同样“类”也是对象
```python
>>> class OneClass:
...     pass
...
>>> OneClass
<class '__main__.OneClass'>
```
当你在定义一个class时，会在内存中一个对象，对象的名字就是类的名字。
**这个对象（类）自身拥有创建对象（类实例）的能力，而这就是为什么它是一个类的原因**

### 动态的创建类
最简单的动态创建方式是将类的定义写在逻辑判断中，不同条件生成不同的类，但这还不够动态，你仍然需要自己去编写整个类的代码。如果想要更动态的创建方式，那我们先来了解一个Python的内建函数**type**
```
class type(object):  # 当传入一个参数时，返回该对象的类型
class type(name, bases, dict)   # 创建新类型，name-类名，bases-父类元组，dict-属性字典
```
了解到这里，我们就可以用type动态创建class了，比如：
```python
>>> A = type('A', (), {})
>>> A
<class '__main__.A'>
>>> B = type('B', (), {'b': True})
>>> B
<class '__main__.B'>
>>> C = type('C', (B,), {'c': False})
>>> C
<class '__main__.C'>
>>> c = C()
>>> c.b
True
>>> c.c
False
>>>
```
现在我们终于接触到元类了，上面使用的type就是元类，type就是Python在背后用来创建所有类的元类。为了证明这一点我们可以使用__class__来验证一下：
```python
>>> class AA:
...     pass
...
>>> def func():
...     pass
...
>>> var = 3
>>> AA.__class__
<class 'type'>
>>> AA.__class__.__class__
<class 'type'>
>>> func.__class__
<class 'function'>
>>> func.__class__.__class__
<class 'type'>
>>> var.__class__
<class 'int'>
>>> var.__class__.__class__
<class 'type'>
```

### 自定义元类
除了使用Python内建的type元类外，我们还可以使用metaclass来控制类的创建行为，如：
```python
class ListMetaclass(type):
    def __new__(cls, name, bases, attrs):
        attrs['add'] = lambda self, value: self.append(value)
        return type.__new__(cls, name, bases, attrs)


class MyList(list, metaclass=ListMetaclass):
    pass


>>> L = MyList()
>>> L.add(1)
>> L
[1]
```
回归开篇的那道题目，实现大致是这样的：
```python
from collections import OrderedDict


class OrderedClass(type):
    @classmethod
    def __prepare__(mcs, name, bases):
        return OrderedDict()

    def __new__(cls, name, bases, classdict):
        result = type.__new__(cls, name, bases, dict(classdict))
        result.__fields__ = list(classdict.keys())
        return result


class Column:
    pass


class MyClass(metaclass=OrderedClass):
    mycol2 = Column()
    mycol3 = Column()
    zut = Column()
    cool = Column()
    menfin = Column()
    a = Column()


print(MyClass.__fields__)
```
在元类中使用__prepare__返回有序字典来存储类成员定义，在元类中创建类，并将有序的属性名赋值给类的__fields__，通过访问__fields__得到与定义顺序相同的属性名称。
想了解更多可以看一下[PEP 3115 -- Metaclasses in Python 3000](https://www.python.org/dev/peps/pep-3115/)
另外，关于类属性定义顺序问题，在Python3.6已经改成默认有序了，详情参考[PEP 520 -- Preserving Class Attribute Definition Order](https://www.python.org/dev/peps/pep-0520/)

## 究竟为什么要使用元类？
```
“元类就是深度的魔法，99%的用户应该根本不必为此操心。如果你想搞清楚究竟是否需要用到元类，那么你就不需要它。那些实际用到元类的人都非常清楚地知道他们需要做什么，而且根本不需要解释为什么要用元类。”  —— Python界的领袖 Tim Peters
```
